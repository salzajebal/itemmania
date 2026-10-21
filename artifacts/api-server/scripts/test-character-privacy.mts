import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { pool } from "@workspace/db";
import { readFile } from "node:fs/promises";

const base = "https://" + process.env.REPLIT_DEV_DOMAIN;
assert(process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev"), "Development preview only");
async function request(path: string, cookie = "", body?: unknown) {
  const response = await fetch(base + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}
async function actor() {
  const result = await request("/auth/register", "", {
    email: "cpqa" + randomBytes(4).toString("hex"),
    password: randomBytes(6).toString("hex"), nickname: "캐릭터검증" + randomBytes(3).toString("hex"),
  });
  assert.equal(result.response.status, 201);
  const cookie = result.response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  assert.equal((await request("/auth/me", cookie)).data.id, result.data.id);
  return { cookie, id: result.data.id };
}
try {
  const buyer = await actor(), seller = await actor(), outsider = await actor();
  const buyerName = "구매자비공개" + randomBytes(4).toString("hex");
  const sellerName = "신청판매자" + randomBytes(4).toString("hex");
  const description = "일반 거래설명\n캐릭터명: 사용자가 직접 작성한 예시";
  const created = await request("/products", buyer.cookie, { title: "캐릭터 비공개 QA", price: 1234, category: "buy",
    gameName: "QA Test Game", serverName: "QA Test Server", description, characterName: buyerName });
  assert.equal(created.response.status, 201);
  const id = created.data.id;
  const stored = await pool.query("SELECT registered_character_name,description,character_name_in_description FROM products WHERE id=$1", [id]);
  assert.equal(stored.rows[0].registered_character_name, buyerName);
  assert.equal(stored.rows[0].description, description);
  for (const cookie of ["", buyer.cookie, seller.cookie, outsider.cookie]) {
    const product = (await request("/products/" + id, cookie)).data;
    assert.equal(product.description, description);
    assert(!JSON.stringify(product).includes(buyerName));
    assert(!("registeredCharacterName" in product));
  }
  for (const tail of ["pc=1", "mobile=1"]) {
    const response = await fetch(base + `/buy/application.html?id=${id}&${tail}`);
    assert.equal(response.status, 200);
    assert(!(await response.text()).includes(buyerName), "Private name leaked in public HTML/scripts");
  }
  const list = await request("/products?category=buy&limit=50");
  assert(!JSON.stringify(list.data).includes(buyerName), "Private name leaked in listing API");
  const chat = await request("/chat/rooms", seller.cookie, { buyerId: buyer.id, productId: id });
  assert.equal(chat.response.status, 201);
  assert(!JSON.stringify(chat.data).includes(buyerName), "Ordinary chat exposed private buyer name");
  const roomId = chat.data.id;
  assert.equal((await request(`/chat/rooms/${roomId}/messages`, seller.cookie)).data.room.buyerCharacterName, null);
  const applied = await request("/chat/rooms", seller.cookie, { buyerId: buyer.id, productId: id, characterName: sellerName });
  assert.equal(applied.response.status, 200);
  assert.equal(applied.data.id, roomId);
  for (const cookie of [buyer.cookie, seller.cookie]) {
    const detail = await request(`/chat/rooms/${roomId}/messages`, cookie);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.data.room.buyerCharacterName, buyerName);
    assert.equal(detail.data.room.sellerCharacterName, sellerName);
  }
  assert.equal((await request(`/chat/rooms/${roomId}/messages`, outsider.cookie)).response.status, 403);
  assert.equal((await request(`/chat/rooms/${roomId}/messages`)).response.status, 401);
  // Model a migrated legacy listing without changing any real pre-existing row.
  await pool.query("UPDATE products SET description=$2,character_name_in_description=true WHERE id=$1", [id, description + "\n캐릭터명: " + buyerName]);
  assert.equal((await request("/products/" + id)).data.description, description);
  assert.equal((await request(`/chat/rooms/${roomId}/messages`, buyer.cookie)).data.room.buyerCharacterName, buyerName);
  const typed = await request("/products", buyer.cookie, { title: "일반 설명 보존 QA", price: 1234, category: "buy", description });
  assert.equal(typed.response.status, 201);
  await pool.query(await readFile("scripts/registered-character-privacy.sql", "utf8"));
  assert.equal((await request("/products/" + typed.data.id)).data.description, description, "Repeated migration reinterpreted new free-form text");
  console.log("PASS: private registration, public API/list/PC/mobile exclusion, chat-before-application exclusion, both participant names, outsider/guest denial, legacy suffix/body preservation and idempotent migration");
} finally { await pool.end(); }
