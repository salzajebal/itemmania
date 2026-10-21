import assert from "node:assert/strict";
import { load } from "cheerio";
import { pool } from "@workspace/db";

// Only the isolated dev QA listing created for prior application testing.
const id = 1420;
const base = "https://" + process.env.REPLIT_DEV_DOMAIN;
const query = async () => {
  const result = await pool.query("SELECT view_count,updated_at FROM products WHERE id=$1 AND itemmania_id LIKE 'user_%'", [id]);
  assert.equal(result.rows.length, 1, "Refusing to test a non-QA/local listing");
  return result.rows[0];
};
const initial = await query();
const count = async () => Number((await query()).view_count);
const page = async (path: string, expected: number) => {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  const $ = load(await response.text());
  assert.equal(Number($(".trade_view_cnt").first().text().replaceAll(",", "")), expected);
};
try {
  const actor = await pool.query("SELECT id FROM users WHERE id=$1 AND email LIKE 'slqa%'", [125]);
  assert.equal(actor.rows.length, 1, "Sell fixture requires our isolated synthetic QA actor");
  const marker = "user_view_qa_" + crypto.randomUUID();
  const sell = await pool.query("INSERT INTO products (itemmania_id,title,price,category,seller_id,game_name,server_name) VALUES($1,$2,1,'sell',125,'QA Test Game','QA Test Server') RETURNING id",
    [marker, "조회수 검사 전용"]);
  const sellId = sell.rows[0].id;
  try {
    await page(`/sell/application.html?id=${sellId}&pc=1`, 1);
    await page(`/sell/application.html?id=${sellId}&mobile=1`, 2);
  } finally {
    await pool.query("DELETE FROM products p WHERE id=$1 AND itemmania_id=$2 AND NOT EXISTS(SELECT 1 FROM chat_rooms WHERE product_id=p.id) AND NOT EXISTS(SELECT 1 FROM orders WHERE product_id=p.id)", [sellId, marker]);
  }
  await fetch(base + `/api/products/${id}`);
  await fetch(base + `/buy/application.html?id=${id}&pc=1`, { method: "HEAD" });
  assert.equal(await count(), initial.view_count, "API/HEAD must not count");
  await page(`/buy/application.html?id=${id}&pc=1`, initial.view_count + 1);
  await page(`/buy/application.html?id=${id}&pc=1`, initial.view_count + 2);
  await page(`/buy/application.html?id=${id}&mobile=1`, initial.view_count + 3);
  const redirect = await fetch(base + `/sell/application.html?id=${id}&mobile=1`, { redirect: "manual" });
  assert.equal(redirect.status, 302);
  assert.equal(await count(), initial.view_count + 3, "Redirect must not count");
  await Promise.all(Array.from({ length: 8 }, () => fetch(base + `/buy/application.html?id=${id}&pc=1`).then(res => assert.equal(res.status, 200))));
  assert.equal(await count(), initial.view_count + 11, "Concurrent GETs must not lose increments");
  assert.equal((await query()).updated_at.toISOString(), initial.updated_at.toISOString(), "Views must not change listing timestamp");
  const api = await (await fetch(base + `/api/products/${id}`)).json();
  assert.equal(api.viewCount, initial.view_count + 11);
  assert.equal(await count(), api.viewCount);
  console.log("PASS: PC/mobile display, refresh, atomic parallel increments, API/HEAD/redirect exclusions, timestamp preservation");
} finally {
  await pool.end();
}
