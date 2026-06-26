---
name: Template literal regex slash
description: In a TS template literal string, \/ becomes / in output; /\/(pat)/ → //(pat)/ which is a JS line comment breaking parsing.
---

## Rule

Inside a TypeScript template literal (backtick string used as injected JS), `\/` is treated as an escape sequence that reduces to `/`. So:

```ts
// Source (TS template literal)
if(/\/(item|goods)/.test(path)){
// Output JavaScript
if(//(item|goods)/.test(path){   // ← // starts a JS line comment!
```

This causes `SyntaxError: Unexpected token 'var'` on the next line (the parser sees an unclosed `if(`).

## Fix

Use a character class `[/]` instead of `\/` to match a literal slash:

```ts
// Source
if(/[/](item|goods)/.test(path)){
// Output JavaScript — correct
if(/[/](item|goods)/.test(path)){
```

**Why:** `\/` in a regular JavaScript source file is fine (redundant escape), but inside a TS template literal the escape is consumed during string value computation, leaving just `/`, which when preceded by another `/` (the regex delimiter) creates `//`.

**How to apply:** Whenever writing regex literals inside TS template literals that need to match a literal `/`, use `[/]` not `\/`. Always run `node --check` on extracted script blocks to verify.
