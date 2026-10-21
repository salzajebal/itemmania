import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import type { Response } from "express";
import { keepEventStreamAlive } from "./event-stream-heartbeat";

test("idle SSE receives comments before proxy timeout; close stops writes and cleans once", t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const res = new EventEmitter() as EventEmitter & { destroyed: boolean; writableEnded: boolean; write: (value: string) => void };
  const writes: string[] = [];
  res.destroyed = false;
  res.writableEnded = false;
  res.write = value => { writes.push(value); };
  let cleanups = 0;
  const stop = keepEventStreamAlive(res as unknown as Response, () => { cleanups++; });
  t.mock.timers.tick(25_000);
  assert.deepEqual(writes, [": heartbeat\n\n"]);
  t.mock.timers.tick(25_000);
  assert.equal(writes.length, 2);
  res.emit("close");
  stop();
  t.mock.timers.tick(100_000);
  assert.equal(writes.length, 2);
  assert.equal(cleanups, 1);
});
