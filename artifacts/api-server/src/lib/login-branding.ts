import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Keep branding in the existing VPS uploads tree, which operating backups retain.
const appRoot = process.env.APP_ROOT
  ? join(process.env.APP_ROOT, "artifacts", "api-server")
  : existsSync(join(process.cwd(), "artifacts", "api-server", "package.json"))
    ? join(process.cwd(), "artifacts", "api-server") : process.cwd();
const directory = join(appRoot, "uploads", "login-branding");
const settingsPath = join(directory, "settings.json");
const brandNamePath = join(directory, "brand-name.json");
type Logo = { file: string; mime: string; updatedAt: string };
let mutationQueue: Promise<unknown> = Promise.resolve();

export function logoImageType(bytes: Buffer): { ext: string; mime: string } | null {
  if (bytes.length < 32) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return { ext: "png", mime: "image/png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { ext: "jpg", mime: "image/jpeg" };
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP")
    return { ext: "webp", mime: "image/webp" };
  return null;
}

export async function readLoginLogo(): Promise<Logo | null> {
  let raw: string;
  try { raw = await readFile(settingsPath, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const logo = JSON.parse(raw) as Logo;
  if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(logo.file) ||
      !["image/png", "image/jpeg", "image/webp"].includes(logo.mime) ||
      !Number.isFinite(Date.parse(logo.updatedAt))) throw new Error("Invalid login logo settings");
  return logo;
}

export async function loginLogoStatus() {
  const logo = await readLoginLogo();
  let brandName = "";
  try {
    brandName = normalizeLoginBrandName(JSON.parse(await readFile(brandNamePath, "utf8")).brandName);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return { logoUrl: logo ? "/api/member-login/logo?v=" + encodeURIComponent(logo.file) : null, updatedAt: logo?.updatedAt ?? null, brandName };
}

export function normalizeLoginBrandName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(value))
    throw new Error("브랜드 이름은 줄바꿈 없이 최대 40자까지 입력하세요.");
  return value.trim();
}

export function updateLoginBrandName(value: unknown) {
  const brandName = normalizeLoginBrandName(value);
  const operation = mutationQueue.then(async () => {
    await mkdir(directory, { recursive: true });
    const temp = join(directory, randomUUID() + ".json.tmp");
    await writeFile(temp, JSON.stringify({ brandName }), { flag: "wx" });
    await rename(temp, brandNamePath);
    return loginLogoStatus();
  });
  mutationQueue = operation.catch(() => {});
  return operation;
}

export async function loginLogoBytes() {
  const logo = await readLoginLogo();
  return logo ? { bytes: await readFile(join(directory, logo.file)), mime: logo.mime } : null;
}

export function updateLoginLogo(bytes: Buffer | null) {
  const operation = mutationQueue.then(async () => {
    await readLoginLogo();
    if (bytes) {
      const type = logoImageType(bytes);
      if (!type) throw new Error("PNG, JPG, WEBP 이미지 파일만 업로드할 수 있습니다.");
      await mkdir(directory, { recursive: true });
      const file = randomUUID() + "." + type.ext;
      await writeFile(join(directory, file), bytes, { flag: "wx" });
      const temp = join(directory, randomUUID() + ".json.tmp");
      await writeFile(temp, JSON.stringify({ file, mime: type.mime, updatedAt: new Date().toISOString() }), { flag: "wx" });
      await rename(temp, settingsPath);
    } else {
      try { await unlink(settingsPath); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    // Small old files are retained so an in-flight page/image response cannot lose its file.
    // They stay inside the existing upload backups; only the active setting is served.
    return loginLogoStatus();
  });
  mutationQueue = operation.catch(() => {});
  return operation;
}
