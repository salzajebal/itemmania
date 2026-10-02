import { randomUUID } from "node:crypto";
import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

async function postJson(api: APIRequestContext, path: string, body: object) {
  const response = await api.post(path, { data: body });
  expect(response.ok(), `${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function patchJson(api: APIRequestContext, path: string, body: object) {
  const response = await api.patch(path, { data: body });
  expect(response.ok(), `${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
}

async function checkMenu(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.ok(), `Failed to load ${path}`).toBeTruthy();

  const button = page.locator(".header-menu").first();
  const panel = page.locator("#headerMainPanel");
  await expect(button).toBeVisible();
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.click();
  await expect(panel).toHaveClass(/is-open/);
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(panel.locator(".header-panel-inner")).toBeVisible();

  await button.click();
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.click();
  await panel.locator(".header-panel-backdrop").click({ position: { x: 10, y: 200 } });
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.click();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await expect(button).toHaveAttribute("aria-expanded", "false");
}

test("signed-in home and completed listing/detail keep the header menu interactive", async ({ page, baseURL }) => {
  // Create a private completed trade rather than depending on existing development data.
  const suffix = randomUUID().slice(0, 12);
  const seller = page.context().request;
  const buyer = await request.newContext({ baseURL: baseURL! });
  try {
    const sellerUser = await postJson(seller, "/api/auth/register", {
      email: `menu-seller-${suffix}@example.test`, nickname: `seller-${suffix}`, password: "test-password-41",
    });
    const buyerUser = await postJson(buyer, "/api/auth/register", {
      email: `menu-buyer-${suffix}@example.test`, nickname: `buyer-${suffix}`, password: "test-password-41",
    });
    expect(sellerUser.id).not.toBe(buyerUser.id);

    const title = `완료 메뉴 검증 ${suffix}`;
    const product = await postJson(seller, "/api/products", {
      title, price: 1000, gameName: "리니지클래식", category: "sell", itemCategory: "게임머니",
    });
    const room = await postJson(buyer, "/api/chat/rooms", {
      sellerId: sellerUser.id, productId: product.id,
    });
    await patchJson(seller, `/api/chat/rooms/${room.id}`, { status: "handover" });
    await patchJson(buyer, `/api/chat/rooms/${room.id}`, { status: "ended" });
    const completed = await seller.get(`/api/products/${product.id}`);
    expect(completed.ok()).toBeTruthy();
    expect((await completed.json()).status).toBe("sold");

    await test.step("home menu", () => checkMenu(page, "/"));
    await test.step("completed listing menu", async () => {
      await checkMenu(page, "/sell/list.html?search_game=5913");
      await expect(page.locator("li.list_item.im-sold").filter({ hasText: title })).toBeVisible();
    });
    await test.step("completed detail menu", async () => {
      await checkMenu(page, `/sell/application.html?id=${product.id}`);
      await expect(page).toHaveTitle(new RegExp(title));
    });
  } finally {
    await buyer.dispose();
  }
});