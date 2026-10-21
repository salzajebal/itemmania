import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { TRADE_CHAT_COMPOSER_SCRIPT } from "./trade-chat-composer";

function fixture() {
  const listeners = new Map<string, Array<(event: any) => void>>();
  const timers: Array<() => void> = [];
  let sends = 0;
  let focused = false;
  const textarea = {
    value: "한글 마지막 글자",
    setAttribute() {},
    addEventListener(name: string, listener: (event: any) => void) {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    },
    focus() { focused = true; },
  };
  let click: (event: any) => void;
  const sendButton = { addEventListener(_name: string, listener: typeof click) { click = listener; } };
  const setup = runInNewContext(TRADE_CHAT_COMPOSER_SCRIPT + "\nsetupTradeChatComposer", {
    setTimeout(fn: () => void) { timers.push(fn); return timers.length; },
    clearTimeout() {},
  });
  const submitted: string[] = [];
  setup(textarea, sendButton, () => { sends++; submitted.push(textarea.value); });
  function emit(name: string, overrides: Record<string, unknown> = {}) {
    const event = {
      key: "Enter", keyCode: 13, isComposing: false, shiftKey: false, repeat: false,
      defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...overrides,
    };
    for (const listener of listeners.get(name) ?? []) listener(event);
    return event;
  }
  return { textarea, emit, flush() { while (timers.length) timers.shift()!(); },
    click() { click!({ preventDefault() {} }); },
    get sends() { return sends; }, get focused() { return focused; }, submitted };
}

test("normal Enter sends once, Shift+Enter keeps multiline, held Enter cannot repeat", () => {
  const f = fixture();
  assert.equal(f.emit("keydown").defaultPrevented, true);
  assert.equal(f.sends, 1);
  assert.equal(f.emit("keydown", { shiftKey: true }).defaultPrevented, false);
  f.emit("keydown", { repeat: true });
  assert.equal(f.sends, 1);
});

test("one Korean composition Enter sends the final input exactly once", () => {
  const f = fixture();
  f.emit("compositionstart");
  assert.equal(f.emit("keydown", { isComposing: true, keyCode: 229 }).defaultPrevented, false);
  assert.equal(f.sends, 0);
  f.emit("compositionend");
  f.emit("keydown"); // Safari/IME confirming Enter for the same physical press.
  f.textarea.value = "한글 마지막 글자까지 완료";
  f.emit("input");
  f.flush();
  assert.equal(f.sends, 1);
  assert.deepEqual(f.submitted, ["한글 마지막 글자까지 완료"]);
  f.emit("keydown"); // No keyup yet: do not send twice.
  assert.equal(f.sends, 1);
  f.emit("keyup");
  f.emit("keydown");
  assert.equal(f.sends, 2);
});

test("composition keyup before compositionend still sends without needing another Enter", () => {
  const f = fixture();
  f.emit("compositionstart");
  f.emit("keydown", { keyCode: 229 });
  f.emit("keyup");
  f.emit("compositionend");
  f.flush();
  assert.equal(f.sends, 1);
});

test("ordinary composition completion and Shift+Enter do not submit a draft", () => {
  const f = fixture();
  f.emit("compositionstart");
  f.emit("keydown", { shiftKey: true, isComposing: true });
  f.emit("compositionend");
  f.flush();
  assert.equal(f.sends, 0);
});

test("mobile Enter with keyCode 229 but no composition session still sends", () => {
  const f = fixture();
  f.emit("keydown", { keyCode: 229 });
  f.flush();
  assert.equal(f.sends, 1);
});

test("send-button restores composer focus and does not double send pending IME Enter", () => {
  const f = fixture();
  f.emit("compositionstart");
  f.emit("keydown", { isComposing: true });
  f.emit("compositionend");
  f.click();
  f.flush();
  assert.equal(f.focused, true);
  assert.equal(f.sends, 1);
});
