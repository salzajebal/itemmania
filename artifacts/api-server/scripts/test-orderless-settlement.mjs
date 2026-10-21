// Isolated development regression test for orderless member-trade settlement.
//
// The test derives a dedicated member_trade_test URL from the runtime
// DATABASE_URL by changing only its pathname. The script starts its own API
// process, pointed at that isolated database rather than the normal app DB.
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Orderless settlement tests are development-only.");
}

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(scriptDir, "..");
const projectDir = path.resolve(apiDir, "../..");
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to derive the dedicated member_trade_test database URL.");
}

const appDatabaseUrl = new URL(process.env.DATABASE_URL);
const databaseUrl = new URL(appDatabaseUrl);
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  throw new Error("DATABASE_URL must be a PostgreSQL URL.");
}
databaseUrl.pathname = "/member_trade_test";
const testDatabaseUrl = databaseUrl.toString();
const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""));
if (appDatabaseUrl.pathname === databaseUrl.pathname) {
  throw new Error("The isolated test database must not be the normal DATABASE_URL target.");
}

// Resolve pg from the DB workspace dependency without adding script dependencies.
const requireFromDbWorkspace = createRequire(path.join(projectDir, "lib/db/package.json"));
const { Pool } = requireFromDbWorkspace("pg");
const testDb = new Pool({ connectionString: testDatabaseUrl, max: 3, connectionTimeoutMillis: 5000 });

const suffix = `${Date.now().toString(36)}-${process.pid.toString(36)}`;
const fixtureUserIds = new Set();
const fixtureProductIds = new Set();
const fixtureRoomIds = new Set();
const fixtureOrderIds = new Set();
let serverProcess;
let serverOutput = "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, label) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function recordServerOutput(chunk) {
  serverOutput = (serverOutput + chunk.toString()).slice(-12000);
}

async function findFreePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  assert(address && typeof address !== "string", "Could not reserve a local test port.");
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function verifyTestSchema() {
  const { rows } = await testDb.query(
    `SELECT current_database() AS database_name, current_schema() AS schema_name,
            json_agg(table_name) AS tables
       FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])
      GROUP BY current_database(), current_schema()`,
    [["users", "wallets", "products", "orders", "escrow_ledger", "chat_rooms", "chat_messages"]],
  );
  const currentDatabase = rows[0]?.database_name;
  equal(currentDatabase, databaseName, "Connected test database");
  const requiredTables = ["users", "wallets", "products", "orders", "escrow_ledger", "chat_rooms", "chat_messages"];
  const present = new Set(rows[0]?.tables ?? []);
  const missing = requiredTables.filter(table => !present.has(table));
  assert(
    missing.length === 0,
    `Dedicated test database is missing schema tables: ${missing.join(", ")}. Apply the DB schema to this test database first.`,
  );
}

async function startIsolatedServer() {
  const port = await findFreePort();
  const tsxCli = path.join(apiDir, "node_modules/tsx/dist/cli.mjs");
  serverProcess = spawn(process.execPath, [tsxCli, "src/index.ts"], {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      PORT: String(port),
      BIND_HOST: "127.0.0.1",
      SESSION_SECRET: `member-trade-test-${suffix}`,
      ADMIN_PASSWORD: "",
      ALLOW_STARTUP_DB_SYNC: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", recordServerOutput);
  serverProcess.stderr.on("data", recordServerOutput);

  const base = `http://127.0.0.1:${port}/api`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Isolated API server exited before startup.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return base;
    } catch {
      // The child is still starting; retry until the bounded deadline.
    }
    await delay(200);
  }
  throw new Error(`Timed out starting the isolated API server.\n${serverOutput}`);
}

async function stopIsolatedServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  serverProcess.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve => serverProcess.once("exit", resolve)),
    delay(5000),
  ]);
  if (serverProcess.exitCode === null) serverProcess.kill("SIGKILL");
}

let base;
async function request(pathname, { method = "GET", body, cookie = "" } = {}) {
  const response = await fetch(base + pathname, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    value: await response.json().catch(() => ({})),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

function expectStatus(result, expected, label) {
  equal(result.status, expected, label);
  return result.value;
}

async function registerAccount(name) {
  const registration = await request("/auth/register", {
    method: "POST",
    body: {
      email: `orderless-${name}-${suffix}@example.invalid`,
      password: "test-only-password-2026",
      nickname: `order${name}${suffix}`.slice(0, 30),
    },
  });
  const account = expectStatus(registration, 201, `register isolated ${name}`);
  assert(account.id && Number.isSafeInteger(account.id), `Registration did not return an ID for ${name}.`);
  fixtureUserIds.add(account.id);
  assert(registration.cookie, `Registration did not issue a session for ${name}.`);
  return { id: account.id, cookie: registration.cookie };
}

async function createProduct(owner, { category = "sell", price = 10000, title, characterName }) {
  const product = expectStatus(await request("/products", {
    method: "POST",
    cookie: owner.cookie,
    body: { title: `${title} ${suffix}`, price: String(price), category, characterName },
  }), 201, `create isolated ${category} listing`);
  assert(product.id && Number.isSafeInteger(product.id), "Listing creation did not return an ID.");
  fixtureProductIds.add(product.id);
  return product;
}

async function createSellRoom(buyer, seller, product) {
  const room = expectStatus(await request("/chat/rooms", {
    method: "POST",
    cookie: buyer.cookie,
    body: { productId: product.id, sellerId: seller.id },
  }), 201, "open sell-listing room");
  fixtureRoomIds.add(room.id);
  return room;
}

async function createBuyRoom(actualSeller, listingOwner, product) {
  const room = expectStatus(await request("/chat/rooms", {
    method: "POST",
    cookie: actualSeller.cookie,
    body: { productId: product.id, buyerId: listingOwner.id },
  }), 201, "open buy-listing room as the actual seller");
  fixtureRoomIds.add(room.id);
  return room;
}

async function changeRoomStatus(room, actor, status, expected = 200) {
  assert(fixtureRoomIds.has(room.id), "Refusing to change a room outside this test's fixtures.");
  return expectStatus(await request(`/chat/rooms/${room.id}`, {
    method: "PATCH",
    cookie: actor.cookie,
    body: { status },
  }), expected, `${status} room #${room.id}`);
}

async function getRoom(room, actor) {
  assert(fixtureRoomIds.has(room.id), "Refusing to read a room outside this test's fixtures.");
  const response = expectStatus(await request(`/chat/rooms/${room.id}/messages`, {
    cookie: actor.cookie,
  }), 200, `read room #${room.id}`);
  return response.room;
}

async function getBalance(userId) {
  assert(fixtureUserIds.has(userId), "Refusing to read a wallet outside this test's registered fixtures.");
  const { rows } = await testDb.query("SELECT balance FROM wallets WHERE user_id = $1", [userId]);
  assert(rows.length === 1, `Expected an isolated wallet for fixture user ${userId}.`);
  return Number(rows[0].balance);
}

async function setBalance(userId, amount) {
  assert(fixtureUserIds.has(userId), "Refusing to modify a wallet outside this test's registered fixtures.");
  const { rowCount } = await testDb.query(
    "UPDATE wallets SET balance = $1 WHERE user_id = $2",
    [amount, userId],
  );
  equal(rowCount, 1, `update isolated wallet ${userId}`);
}

async function setProductPrice(productId, amount) {
  assert(fixtureProductIds.has(productId), "Refusing to modify a product outside this test's fixtures.");
  const { rowCount } = await testDb.query("UPDATE products SET price = $1 WHERE id = $2", [amount, productId]);
  equal(rowCount, 1, `update isolated listing ${productId}`);
}

async function setProductStatus(productId, status) {
  assert(fixtureProductIds.has(productId), "Refusing to modify a product outside this test's fixtures.");
  const { rowCount } = await testDb.query("UPDATE products SET status = $1 WHERE id = $2", [status, productId]);
  equal(rowCount, 1, `update isolated listing ${productId}`);
}

async function productStatus(productId) {
  assert(fixtureProductIds.has(productId), "Refusing to read a product outside this test's fixtures.");
  const { rows } = await testDb.query("SELECT status FROM products WHERE id = $1", [productId]);
  assert(rows.length === 1, `Expected isolated listing ${productId}.`);
  return rows[0].status;
}

async function productOrders(productId) {
  assert(fixtureProductIds.has(productId), "Refusing to inspect orders for a product outside this test's fixtures.");
  const { rows } = await testDb.query(
    `SELECT id, buyer_id, seller_id, product_id, product_title, amount, fee_amount, status
       FROM orders WHERE product_id = $1 ORDER BY id`,
    [productId],
  );
  for (const order of rows) fixtureOrderIds.add(Number(order.id));
  return rows.map(order => ({
    id: Number(order.id),
    buyerId: Number(order.buyer_id),
    sellerId: Number(order.seller_id),
    productId: Number(order.product_id),
    productTitle: order.product_title,
    amount: Number(order.amount),
    feeAmount: Number(order.fee_amount),
    status: order.status,
  }));
}

async function setOrderFeeAmount(orderId, amount) {
  assert(fixtureOrderIds.has(orderId), "Refusing to modify an order outside this test's fixtures.");
  const { rowCount } = await testDb.query(
    "UPDATE orders SET fee_amount = $1 WHERE id = $2",
    [amount, orderId],
  );
  equal(rowCount, 1, `update isolated order ${orderId} fee`);
}

async function orderLedger(orderId) {
  const { rows } = await testDb.query(
    "SELECT type, amount FROM escrow_ledger WHERE order_id = $1 ORDER BY id",
    [orderId],
  );
  return rows.map(entry => ({ type: entry.type, amount: Number(entry.amount) }));
}

function netAmount(amount) {
  return amount;
}

async function assertOrderlessFailureState(room, buyer, seller, product, buyerBefore, sellerBefore, label) {
  const roomState = await getRoom(room, buyer);
  equal(roomState.status, "handover", `${label} preserves handover status`);
  equal(roomState.orderId, null, `${label} creates no linked order`);
  equal(roomState.orderStatus, null, `${label} has no order status`);
  equal((await productOrders(product.id)).length, 0, `${label} creates no order`);
  equal(await productStatus(product.id), "active", `${label} leaves listing active`);
  equal(await getBalance(buyer.id), buyerBefore, `${label} preserves buyer balance`);
  equal(await getBalance(seller.id), sellerBefore, `${label} preserves seller balance`);
}

async function runRegressionTests() {
  // Verify the two roles in both sell and buy listing applications without funds.
  const nicknameSeller = await registerAccount("nickSeller");
  const nicknameBuyer = await registerAccount("nickBuyer");
  for (const category of ["sell", "buy"]) {
    const owner = category === "sell" ? nicknameSeller : nicknameBuyer;
    const applicant = category === "sell" ? nicknameBuyer : nicknameSeller;
    const product = await createProduct(owner, {
      category, title: `character-names-${category}`, characterName: `등록-${category}`,
    });
    const applicationBody = category === "sell"
      ? { sellerId: nicknameSeller.id, productId: product.id }
      : { buyerId: nicknameBuyer.id, productId: product.id };
    const room = expectStatus(await request("/chat/rooms", {
      method: "POST", cookie: applicant.cookie,
      body: { ...applicationBody, characterName: `신청-${category}`, sellerCharacterName: "위조" },
    }), 201, "create role-specific character room");
    fixtureRoomIds.add(room.id);
    for (const viewer of [nicknameBuyer, nicknameSeller]) {
      const detail = await getRoom(room, viewer);
      equal(detail.buyerCharacterName, category === "sell" ? "신청-sell" : "등록-buy", "correct buyer game name");
      equal(detail.sellerCharacterName, category === "sell" ? "등록-sell" : "신청-buy", "correct seller game name");
      assert(detail.buyerNickname && detail.sellerNickname, "Existing account nicknames must remain.");
    }
    expectStatus(await request("/chat/rooms", {
      method: "POST", cookie: applicant.cookie,
      body: { ...applicationBody, characterName: "덮어쓰기시도" },
    }), 200, "reuse existing character room");
    const detail = await getRoom(room, applicant);
    const buyerActor = category === "buy" ? owner : applicant;
    const sellerActor = category === "buy" ? applicant : owner;
    for (const [side, actor] of [["buy", buyerActor], ["sell", sellerActor]]) {
      const stats = expectStatus(await request("/products/my/stats", { cookie: actor.cookie }), 200, "myroom stats");
      assert(stats[side === "buy" ? "buyProcessing" : "sellActive"] >= 1, "application is an ongoing trade before payment");
      const origin = base.replace(/[/]api$/, "");
      const page = await fetch(origin + `/myroom/${side}/${side}_ing.html`, { headers: { Cookie: actor.cookie } });
      const html = await page.text();
      equal(page.status, 200, "existing ongoing trade page");
      assert(html.includes(`roomId=${room.id}`), "ongoing entry reopens exact application room");
      assert(!html.includes(`data-order-id="${room.id}"`), "orderless room cannot invoke an unrelated order action");
    }
    equal(detail.characterName, `신청-${category}`, "legacy field preserved");
    equal(detail[category === "sell" ? "buyerCharacterName" : "sellerCharacterName"],
      `신청-${category}`, "recorded application name is not overwritten");
    expectStatus(await request("/chat/rooms", {
      method: "POST", cookie: applicant.cookie, body: { ...applicationBody, characterName: 123 },
    }), 400, "reject non-text game name");
  }
  const seller = await registerAccount("seller");
  const buyer = await registerAccount("buyer");
  const secondBuyer = await registerAccount("secondbuyer");
  const poorBuyer = await registerAccount("poorbuyer");
  await setBalance(seller.id, 5000);
  await setBalance(buyer.id, 200000);
  await setBalance(secondBuyer.id, 200000);
  await setBalance(poorBuyer.id, 0);

  // Orderless completion uses the current persisted listing price. Seller handover
  // remains a delivery-only step and must not debit either participant.
  const currentPrice = 12345;
  const currentPriceProduct = await createProduct(seller, {
    price: 10000,
    title: "current-price settlement",
  });
  const currentPriceRoom = await createSellRoom(buyer, seller, currentPriceProduct);
  const buyerBeforeHandover = await getBalance(buyer.id);
  const sellerBeforeHandover = await getBalance(seller.id);
  equal((await getRoom(currentPriceRoom, buyer)).orderId, null, "new orderless room starts unpaid");
  await changeRoomStatus(currentPriceRoom, seller, "handover");
  equal(await getBalance(buyer.id), buyerBeforeHandover, "handover does not debit buyer");
  equal(await getBalance(seller.id), sellerBeforeHandover, "handover does not credit seller");
  await setProductPrice(currentPriceProduct.id, currentPrice);
  const currentProduct = expectStatus(await request(`/products/${currentPriceProduct.id}`), 200, "read current listing price");
  equal(currentProduct.price, currentPrice, "server listing price changed before receipt");

  const currentPriceResult = await changeRoomStatus(currentPriceRoom, buyer, "ended");
  equal(currentPriceResult.status, "ended", "orderless completion closes room");
  const settledRoom = await getRoom(currentPriceRoom, buyer);
  assert(settledRoom.orderId, "Orderless completion did not attach the new order to its room.");
  equal(settledRoom.orderStatus, "completed", "orderless order is completed");
  equal(settledRoom.productPrice, currentPrice, "room reflects the price used for settlement");
  const currentPriceOrders = await productOrders(currentPriceProduct.id);
  equal(currentPriceOrders.length, 1, "one order created for orderless completion");
  const currentPriceOrder = currentPriceOrders[0];
  equal(currentPriceOrder.id, settledRoom.orderId, "room is linked to its order");
  equal(currentPriceOrder.buyerId, buyer.id, "order has the room buyer");
  equal(currentPriceOrder.sellerId, seller.id, "order has the room seller");
  equal(currentPriceOrder.amount, currentPrice, "order uses current server price");
  equal(currentPriceOrder.feeAmount, 0, "newly settled order records no fee");
  equal(currentPriceOrder.status, "completed", "created order is completed");
  equal(await getBalance(buyer.id), buyerBeforeHandover - currentPrice, "buyer pays current price once");
  equal(await getBalance(seller.id), sellerBeforeHandover + netAmount(currentPrice), "seller receives full amount");
  const currentLedger = await orderLedger(currentPriceOrder.id);
  equal(currentLedger.length, 2, "settlement records charge and release");
  equal(currentLedger.filter(entry => entry.type === "charge").length, 1, "one charge ledger entry");
  equal(currentLedger.filter(entry => entry.type === "release").length, 1, "one release ledger entry");
  equal(currentLedger.find(entry => entry.type === "charge").amount, currentPrice, "charge records gross amount");
  equal(currentLedger.find(entry => entry.type === "release").amount, currentPrice, "release records full seller amount");
  equal(await productStatus(currentPriceProduct.id), "sold", "completed listing is sold");
  await changeRoomStatus(currentPriceRoom, buyer, "ended", 400);
  equal(await getBalance(buyer.id), buyerBeforeHandover - currentPrice, "repeat completion does not debit again");
  equal(await getBalance(seller.id), sellerBeforeHandover + netAmount(currentPrice), "repeat completion does not credit again");
  equal((await productOrders(currentPriceProduct.id)).length, 1, "repeat completion does not create another order");
  equal((await orderLedger(currentPriceOrder.id)).length, 2, "repeat completion does not add ledger entries");
  const historicalCompletedFee = Math.floor(currentPrice * 0.033);
  await setOrderFeeAmount(currentPriceOrder.id, historicalCompletedFee);

  // A product-less room cannot be settled, but seller handover remains allowed.
  const noProductRoom = expectStatus(await request("/chat/rooms", {
    method: "POST",
    cookie: buyer.cookie,
    body: { sellerId: seller.id },
  }), 201, "open product-less room");
  fixtureRoomIds.add(noProductRoom.id);
  const noProductBuyerBefore = await getBalance(buyer.id);
  const noProductSellerBefore = await getBalance(seller.id);
  await changeRoomStatus(noProductRoom, seller, "handover");
  equal(await getBalance(buyer.id), noProductBuyerBefore, "product-less handover does not debit");
  await changeRoomStatus(noProductRoom, buyer, "ended", 400);
  const noProductState = await getRoom(noProductRoom, buyer);
  equal(noProductState.status, "handover", "product-less rejection preserves room state");
  equal(noProductState.orderId, null, "product-less rejection creates no order");
  equal(await getBalance(buyer.id), noProductBuyerBefore, "product-less rejection preserves buyer balance");
  equal(await getBalance(seller.id), noProductSellerBefore, "product-less rejection preserves seller balance");

  // Reject invalid prices transactionally, and prevent self-trade room creation.
  const invalidPriceProduct = await createProduct(seller, {
    price: 10000,
    title: "invalid-price settlement",
  });
  const invalidPriceRoom = await createSellRoom(buyer, seller, invalidPriceProduct);
  const invalidBuyerBefore = await getBalance(buyer.id);
  const invalidSellerBefore = await getBalance(seller.id);
  await changeRoomStatus(invalidPriceRoom, seller, "handover");
  await setProductPrice(invalidPriceProduct.id, 0);
  await changeRoomStatus(invalidPriceRoom, buyer, "ended", 400);
  await assertOrderlessFailureState(
    invalidPriceRoom,
    buyer,
    seller,
    invalidPriceProduct,
    invalidBuyerBefore,
    invalidSellerBefore,
    "invalid price",
  );
  expectStatus(await request("/chat/rooms", {
    method: "POST",
    cookie: seller.cookie,
    body: { productId: invalidPriceProduct.id, sellerId: seller.id },
  }), 400, "reject self-trade");

  // Insufficient buyer funds must roll back every partial settlement write.
  const poorProduct = await createProduct(seller, { price: 30000, title: "insufficient-balance" });
  const poorRoom = await createSellRoom(poorBuyer, seller, poorProduct);
  const poorBuyerBefore = await getBalance(poorBuyer.id);
  const poorSellerBefore = await getBalance(seller.id);
  await changeRoomStatus(poorRoom, seller, "handover");
  await changeRoomStatus(poorRoom, poorBuyer, "ended", 400);
  await assertOrderlessFailureState(
    poorRoom,
    poorBuyer,
    seller,
    poorProduct,
    poorBuyerBefore,
    poorSellerBefore,
    "insufficient balance",
  );

  // Concurrent confirmation on one room can settle only once.
  const concurrentPrice = 22000;
  const concurrentProduct = await createProduct(seller, {
    price: concurrentPrice,
    title: "concurrent-completion",
  });
  const concurrentRoom = await createSellRoom(buyer, seller, concurrentProduct);
  const concurrentBuyerBefore = await getBalance(buyer.id);
  const concurrentSellerBefore = await getBalance(seller.id);
  await changeRoomStatus(concurrentRoom, seller, "handover");
  const concurrentResults = await Promise.all([
    request(`/chat/rooms/${concurrentRoom.id}`, {
      method: "PATCH", cookie: buyer.cookie, body: { status: "ended" },
    }),
    request(`/chat/rooms/${concurrentRoom.id}`, {
      method: "PATCH", cookie: buyer.cookie, body: { status: "ended" },
    }),
  ]);
  equal(concurrentResults.filter(result => result.status === 200).length, 1, "one concurrent completion succeeds");
  equal(concurrentResults.filter(result => result.status === 400).length, 1, "one concurrent completion is rejected");
  await changeRoomStatus(concurrentRoom, buyer, "ended", 400);
  const concurrentOrderRows = await productOrders(concurrentProduct.id);
  equal(concurrentOrderRows.length, 1, "concurrent confirmation creates one order");
  equal(concurrentOrderRows[0].status, "completed", "concurrent order is completed");
  equal(concurrentOrderRows[0].feeAmount, 0, "concurrent settlement records no fee");
  const concurrentRoomState = await getRoom(concurrentRoom, buyer);
  equal(concurrentRoomState.orderId, concurrentOrderRows[0].id, "concurrent order remains linked");
  equal((await orderLedger(concurrentOrderRows[0].id)).length, 2, "concurrent confirmation creates one charge/release pair");
  equal(await getBalance(buyer.id), concurrentBuyerBefore - concurrentPrice, "concurrent confirmation debits once");
  equal(await getBalance(seller.id), concurrentSellerBefore + netAmount(concurrentPrice), "concurrent confirmation credits once");

  // Different rooms for one listing race on the same product; only one buyer settles.
  const competingPrice = 18000;
  const competingProduct = await createProduct(seller, {
    price: competingPrice,
    title: "competing-rooms",
  });
  const [roomA, roomB] = await Promise.all([
    createSellRoom(buyer, seller, competingProduct),
    createSellRoom(secondBuyer, seller, competingProduct),
  ]);
  const buyerABefore = await getBalance(buyer.id);
  const buyerBBefore = await getBalance(secondBuyer.id);
  const competingSellerBefore = await getBalance(seller.id);
  await changeRoomStatus(roomA, seller, "handover");
  await changeRoomStatus(roomB, seller, "handover");
  const competingResults = await Promise.all([
    request(`/chat/rooms/${roomA.id}`, {
      method: "PATCH", cookie: buyer.cookie, body: { status: "ended" },
    }),
    request(`/chat/rooms/${roomB.id}`, {
      method: "PATCH", cookie: secondBuyer.cookie, body: { status: "ended" },
    }),
  ]);
  equal(competingResults.filter(result => result.status === 200).length, 1, "one competing room settles");
  equal(competingResults.filter(result => result.status === 400).length, 1, "other competing room is rejected");
  const competingOrders = await productOrders(competingProduct.id);
  equal(competingOrders.length, 1, "competing rooms create one product order");
  const winningOrder = competingOrders[0];
  equal(winningOrder.status, "completed", "winning competing order completes");
  equal(winningOrder.feeAmount, 0, "competing settlement records no fee");
  const roomAState = await getRoom(roomA, buyer);
  const roomBState = await getRoom(roomB, secondBuyer);
  equal(Number(roomAState.orderId === winningOrder.id) + Number(roomBState.orderId === winningOrder.id), 1,
    "only winning room links the order");
  equal((await orderLedger(winningOrder.id)).length, 2, "competing rooms create one charge/release pair");
  equal(await productStatus(competingProduct.id), "sold", "competing listing closes");
  equal(await getBalance(buyer.id), buyerABefore - (winningOrder.buyerId === buyer.id ? competingPrice : 0),
    "first buyer is charged only if their room wins");
  equal(await getBalance(secondBuyer.id), buyerBBefore - (winningOrder.buyerId === secondBuyer.id ? competingPrice : 0),
    "second buyer is charged only if their room wins");
  equal(await getBalance(seller.id), competingSellerBefore + netAmount(competingPrice), "competing settlement pays seller once");
  equal(roomAState.status, winningOrder.buyerId === buyer.id ? "ended" : "handover", "room A status matches winner");
  equal(roomBState.status, winningOrder.buyerId === secondBuyer.id ? "ended" : "handover", "room B status matches winner");

  // An archived listing stays inactive after handover, but a second already-open
  // room must still see the first settlement and must not charge another buyer.
  const archivedPrice = 19600;
  const archivedProduct = await createProduct(seller, {
    price: archivedPrice,
    title: "archived-competing-rooms",
  });
  const [archivedRoomA, archivedRoomB] = await Promise.all([
    createSellRoom(buyer, seller, archivedProduct),
    createSellRoom(secondBuyer, seller, archivedProduct),
  ]);
  const archivedBuyerABefore = await getBalance(buyer.id);
  const archivedBuyerBBefore = await getBalance(secondBuyer.id);
  const archivedSellerBefore = await getBalance(seller.id);
  await changeRoomStatus(archivedRoomA, seller, "handover");
  await changeRoomStatus(archivedRoomB, seller, "handover");
  await setProductStatus(archivedProduct.id, "inactive");
  const archivedResults = await Promise.all([
    request(`/chat/rooms/${archivedRoomA.id}`, {
      method: "PATCH", cookie: buyer.cookie, body: { status: "ended" },
    }),
    request(`/chat/rooms/${archivedRoomB.id}`, {
      method: "PATCH", cookie: secondBuyer.cookie, body: { status: "ended" },
    }),
  ]);
  equal(archivedResults.filter(result => result.status === 200).length, 1, "one archived competing room settles");
  equal(archivedResults.filter(result => result.status === 400).length, 1, "other archived competing room is rejected");
  const archivedOrders = await productOrders(archivedProduct.id);
  equal(archivedOrders.length, 1, "archived competing rooms create one order");
  const archivedOrder = archivedOrders[0];
  equal(archivedOrder.feeAmount, 0, "archived settlement records no fee");
  const archivedStateA = await getRoom(archivedRoomA, buyer);
  const archivedStateB = await getRoom(archivedRoomB, secondBuyer);
  equal(Number(archivedStateA.orderId === archivedOrder.id) + Number(archivedStateB.orderId === archivedOrder.id), 1,
    "only winning archived room links its order");
  equal(archivedStateA.status, archivedOrder.buyerId === buyer.id ? "ended" : "handover",
    "archived room A status matches winner");
  equal(archivedStateB.status, archivedOrder.buyerId === secondBuyer.id ? "ended" : "handover",
    "archived room B status matches winner");
  equal(await productStatus(archivedProduct.id), "inactive", "settlement preserves archived listing status");
  equal((await orderLedger(archivedOrder.id)).length, 2, "archived settlement records one charge/release pair");
  equal(await getBalance(buyer.id),
    archivedBuyerABefore - (archivedOrder.buyerId === buyer.id ? archivedPrice : 0),
    "archived competing settlement charges buyer A at most once");
  equal(await getBalance(secondBuyer.id),
    archivedBuyerBBefore - (archivedOrder.buyerId === secondBuyer.id ? archivedPrice : 0),
    "archived competing settlement charges buyer B at most once");
  equal(await getBalance(seller.id), archivedSellerBefore + netAmount(archivedPrice),
    "archived competing settlement pays seller once");

  // For a buy listing, the listing owner is the buyer; the responding member is
  // the actual room seller and must receive the proceeds.
  const buyPrice = 15400;
  const buyProduct = await createProduct(secondBuyer, {
    category: "buy",
    price: buyPrice,
    title: "buy-listing-actual-seller",
  });
  const buyRoom = await createBuyRoom(seller, secondBuyer, buyProduct);
  const buyRoomBefore = await getRoom(buyRoom, seller);
  equal(buyRoomBefore.buyerId, secondBuyer.id, "buy listing owner is room buyer");
  equal(buyRoomBefore.sellerId, seller.id, "responding member is actual room seller");
  const buyBuyerBefore = await getBalance(secondBuyer.id);
  const buySellerBefore = await getBalance(seller.id);
  await changeRoomStatus(buyRoom, seller, "handover");
  equal(await getBalance(secondBuyer.id), buyBuyerBefore, "buy-listing handover does not debit buyer");
  await changeRoomStatus(buyRoom, secondBuyer, "ended");
  const buyRoomAfter = await getRoom(buyRoom, secondBuyer);
  const buyOrders = await productOrders(buyProduct.id);
  equal(buyOrders.length, 1, "buy listing creates one settlement order");
  equal(buyOrders[0].buyerId, secondBuyer.id, "buy order buyer is listing owner");
  equal(buyOrders[0].sellerId, seller.id, "buy order seller is responding member");
  equal(buyOrders[0].amount, buyPrice, "buy order uses listing price");
  equal(buyOrders[0].feeAmount, 0, "buy settlement records no fee");
  equal(buyRoomAfter.orderId, buyOrders[0].id, "buy room links to its order");
  equal(await getBalance(secondBuyer.id), buyBuyerBefore - buyPrice, "buy listing buyer is charged");
  equal(await getBalance(seller.id), buySellerBefore + netAmount(buyPrice), "buy listing pays actual seller in full");
  equal((await orderLedger(buyOrders[0].id)).length, 2, "buy listing records charge and release");

  // Prepaid buy listings must restore the listing owner's funds and reactivate the
  // buy post whether cancellation is initiated through either public route.
  const buyCancelOrderPrice = 12500;
  const buyCancelOrderProduct = await createProduct(secondBuyer, {
    category: "buy",
    price: buyCancelOrderPrice,
    title: "buy-cancel-via-orders",
  });
  const buyCancelOrderRoom = await createBuyRoom(seller, secondBuyer, buyCancelOrderProduct);
  const ownerBeforeOrderCancel = await getBalance(secondBuyer.id);
  const sellerBeforeOrderCancel = await getBalance(seller.id);
  const buyCancelOrder = expectStatus(await request(`/chat/rooms/${buyCancelOrderRoom.id}/pay`, {
    method: "POST",
    cookie: secondBuyer.cookie,
  }), 201, "prepay buy listing for orders cancellation");
  equal(buyCancelOrder.sellerId, seller.id, "buy cancellation order records actual seller");
  equal(await getBalance(secondBuyer.id), ownerBeforeOrderCancel - buyCancelOrderPrice,
    "prepaid buy listing debits owner before cancellation");
  expectStatus(await request(`/orders/${buyCancelOrder.id}/cancel`, {
    method: "PATCH",
    cookie: secondBuyer.cookie,
    body: { reason: "isolated regression test" },
  }), 200, "cancel prepaid buy listing through order route");
  equal(await getBalance(secondBuyer.id), ownerBeforeOrderCancel, "order-route buy cancellation refunds owner");
  equal(await getBalance(seller.id), sellerBeforeOrderCancel, "order-route buy cancellation does not pay seller");
  equal(await productStatus(buyCancelOrderProduct.id), "active", "order-route buy cancellation reactivates listing");
  const buyOrderCancelState = await getRoom(buyCancelOrderRoom, seller);
  equal(buyOrderCancelState.status, "cancelled", "order-route cancellation closes linked room");
  equal(buyOrderCancelState.orderId, buyCancelOrder.id, "order-route cancellation keeps linked order");
  equal(buyOrderCancelState.orderStatus, "cancelled", "order-route cancellation marks order cancelled");
  const buyOrderCancelLedger = await orderLedger(buyCancelOrder.id);
  equal(buyOrderCancelLedger.length, 2, "order-route buy cancellation records charge and refund");
  equal(buyOrderCancelLedger.filter(entry => entry.type === "charge").length, 1,
    "order-route buy cancellation has one charge");
  equal(buyOrderCancelLedger.filter(entry => entry.type === "refund").length, 1,
    "order-route buy cancellation has one refund");

  const buyCancelChatPrice = 13200;
  const buyCancelChatProduct = await createProduct(secondBuyer, {
    category: "buy",
    price: buyCancelChatPrice,
    title: "buy-cancel-via-chat",
  });
  const buyCancelChatRoom = await createBuyRoom(seller, secondBuyer, buyCancelChatProduct);
  const ownerBeforeChatCancel = await getBalance(secondBuyer.id);
  const sellerBeforeChatCancel = await getBalance(seller.id);
  const buyCancelChatOrder = expectStatus(await request(`/chat/rooms/${buyCancelChatRoom.id}/pay`, {
    method: "POST",
    cookie: secondBuyer.cookie,
  }), 201, "prepay buy listing for chat cancellation");
  equal(await getBalance(secondBuyer.id), ownerBeforeChatCancel - buyCancelChatPrice,
    "chat-cancel buy listing debits owner before cancellation");
  await changeRoomStatus(buyCancelChatRoom, secondBuyer, "cancelled");
  equal(await getBalance(secondBuyer.id), ownerBeforeChatCancel, "chat-route buy cancellation refunds owner");
  equal(await getBalance(seller.id), sellerBeforeChatCancel, "chat-route buy cancellation does not pay seller");
  equal(await productStatus(buyCancelChatProduct.id), "active", "chat-route buy cancellation reactivates listing");
  const buyChatCancelState = await getRoom(buyCancelChatRoom, secondBuyer);
  equal(buyChatCancelState.status, "cancelled", "chat-route buy cancellation closes room");
  equal(buyChatCancelState.orderId, buyCancelChatOrder.id, "chat-route cancellation keeps linked order");
  equal(buyChatCancelState.orderStatus, "cancelled", "chat-route cancellation marks order cancelled");
  const buyChatCancelLedger = await orderLedger(buyCancelChatOrder.id);
  equal(buyChatCancelLedger.length, 2, "chat-route buy cancellation records charge and refund");
  equal(buyChatCancelLedger.filter(entry => entry.type === "charge").length, 1,
    "chat-route buy cancellation has one charge");
  equal(buyChatCancelLedger.filter(entry => entry.type === "refund").length, 1,
    "chat-route buy cancellation has one refund");

  // Legacy pre-paid rooms still charge at /pay only and never debit again at receipt.
  const prepaidPrice = 11000;
  const prepaidProduct = await createProduct(seller, {
    price: prepaidPrice,
    title: "prepaid-no-second-debit",
  });
  const prepaidRoom = await createSellRoom(buyer, seller, prepaidProduct);
  const prepaidBuyerBefore = await getBalance(buyer.id);
  const prepaidSellerBefore = await getBalance(seller.id);
  const prepaidOrder = expectStatus(await request(`/chat/rooms/${prepaidRoom.id}/pay`, {
    method: "POST",
    cookie: buyer.cookie,
  }), 201, "prepay legacy room");
  equal(prepaidOrder.amount, prepaidPrice, "prepaid order records listing amount");
  equal(await getBalance(buyer.id), prepaidBuyerBefore - prepaidPrice, "prepaid path debits at payment");
  const prepaidRowsBeforeCompletion = await productOrders(prepaidProduct.id);
  equal(prepaidRowsBeforeCompletion.length, 1, "prepaid path creates one order");
  const legacyFeeAmount = Math.floor(prepaidPrice * 0.033);
  assert(legacyFeeAmount > 0, "legacy fixture must have a positive stored fee");
  await setOrderFeeAmount(prepaidOrder.id, legacyFeeAmount);
  equal((await productOrders(prepaidProduct.id))[0].feeAmount, legacyFeeAmount,
    "legacy prepaid fixture starts with a stored fee");
  const prepaidBuyerAfterPay = await getBalance(buyer.id);
  await changeRoomStatus(prepaidRoom, seller, "handover");
  equal(await getBalance(buyer.id), prepaidBuyerAfterPay, "prepaid handover does not debit again");
  await changeRoomStatus(prepaidRoom, buyer, "ended");
  const prepaidState = await getRoom(prepaidRoom, buyer);
  equal(prepaidState.orderId, prepaidOrder.id, "prepaid room retains original order");
  equal(prepaidState.orderStatus, "completed", "prepaid order completes through legacy flow");
  equal(await getBalance(buyer.id), prepaidBuyerAfterPay, "prepaid receipt does not debit a second time");
  equal(await getBalance(seller.id), prepaidSellerBefore + prepaidPrice, "chat completion pays the prepaid seller in full");
  const prepaidRows = await productOrders(prepaidProduct.id);
  equal(prepaidRows.length, 1, "prepaid completion does not create a second order");
  equal(prepaidRows[0].id, prepaidOrder.id, "prepaid path uses original order");
  equal(prepaidRows[0].feeAmount, 0, "chat completion clears the legacy fee");
  equal((await orderLedger(prepaidOrder.id)).filter(entry => entry.type === "charge").length, 1,
    "prepaid path records one charge");
  equal((await orderLedger(prepaidOrder.id)).filter(entry => entry.type === "release").length, 1,
    "prepaid path records one release");
  equal((await orderLedger(prepaidOrder.id)).find(entry => entry.type === "release").amount, prepaidPrice,
    "chat completion releases the full prepaid amount");

  // The order confirmation route applies the same full-amount settlement to a
  // legacy shipped order, while leaving already-completed rows untouched.
  const confirmPrice = 14300;
  const confirmProduct = await createProduct(seller, {
    price: confirmPrice,
    title: "legacy-prepaid-confirm-route",
  });
  const confirmRoom = await createSellRoom(buyer, seller, confirmProduct);
  const confirmBuyerBefore = await getBalance(buyer.id);
  const confirmSellerBefore = await getBalance(seller.id);
  const confirmOrder = expectStatus(await request(`/chat/rooms/${confirmRoom.id}/pay`, {
    method: "POST",
    cookie: buyer.cookie,
  }), 201, "prepay legacy order for order confirmation");
  equal(await getBalance(buyer.id), confirmBuyerBefore - confirmPrice,
    "order-confirmation fixture debits buyer at payment");
  const confirmOrderRows = await productOrders(confirmProduct.id);
  equal(confirmOrderRows.length, 1, "order-confirmation fixture creates one order");
  await setOrderFeeAmount(confirmOrder.id, Math.floor(confirmPrice * 0.033));
  await changeRoomStatus(confirmRoom, seller, "handover");
  const confirmResult = expectStatus(await request(`/orders/${confirmOrder.id}/confirm`, {
    method: "PATCH",
    cookie: buyer.cookie,
  }), 200, "confirm legacy shipped order");
  equal(confirmResult.status, "completed", "order-confirmation route completes legacy order");
  equal(confirmResult.feeAmount, 0, "order-confirmation route clears the legacy fee");
  equal(confirmResult.netAmount, confirmPrice, "order-confirmation route reports full seller amount");
  equal(await getBalance(buyer.id), confirmBuyerBefore - confirmPrice,
    "order confirmation does not debit buyer again");
  equal(await getBalance(seller.id), confirmSellerBefore + confirmPrice,
    "order confirmation pays seller in full");
  const confirmedRows = await productOrders(confirmProduct.id);
  equal(confirmedRows[0].feeAmount, 0, "confirmed order stores no fee");
  equal((await orderLedger(confirmOrder.id)).find(entry => entry.type === "release").amount, confirmPrice,
    "order confirmation releases the full amount");
  const confirmedRoomState = await getRoom(confirmRoom, buyer);
  equal(confirmedRoomState.status, "ended", "order confirmation ends the linked chat room");
  equal(confirmedRoomState.orderId, confirmOrder.id, "order confirmation keeps the room linked");

  equal((await productOrders(currentPriceProduct.id))[0].feeAmount, historicalCompletedFee,
    "existing completed fixture retains its historical fee");

  console.log("ALL ISOLATED ORDERLESS SETTLEMENT REGRESSION CHECKS PASSED");
}

try {
  await verifyTestSchema();
  await testDb.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0");
  await testDb.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS registered_character_name text, ADD COLUMN IF NOT EXISTS character_name_in_description boolean NOT NULL DEFAULT false");
  await testDb.query(`ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by text`);
  await testDb.query(`ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS buyer_character_name text,
    ADD COLUMN IF NOT EXISTS seller_character_name text,
    ADD COLUMN IF NOT EXISTS buyer_dismissed_at timestamptz,
    ADD COLUMN IF NOT EXISTS seller_dismissed_at timestamptz,
    ADD COLUMN IF NOT EXISTS admin_deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS admin_deleted_by text`);
  await testDb.query(`ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS admin_deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS admin_deleted_by text`);
  base = await startIsolatedServer();
  await runRegressionTests();
} finally {
  await stopIsolatedServer();
  await testDb.end();
}