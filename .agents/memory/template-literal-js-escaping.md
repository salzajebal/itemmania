---
name: Template literal JS escaping
description: How to correctly escape single quotes in JavaScript code that lives inside a TypeScript template literal (e.g. inline <script> blocks in HTML-as-string)
---

## The rule

When JavaScript code is embedded inside a TypeScript template literal (backtick string), escape sequences are processed at compile time. `\'` inside a template literal becomes `'` in the compiled output — stripping the backslash. If that JS code is then sent to the browser as a `<script>` block, the browser sees `'` not `\'`, which can break string literals and cause a SyntaxError.

**To get `\'` in the browser's script, write `\\'` in the TypeScript template literal.**

```typescript
// WRONG — compiles to ','approved')  → SyntaxError in browser
const html = `
  +'<button onclick="processWd('+id+',\'approved\')">OK</button>'
`;

// CORRECT — compiles to ,'\'approved\')  → valid JS in browser
const html = `
  +'<button onclick="processWd('+id+',\\'approved\\')">OK</button>'
`;
```

**Why:** Template literal escape processing consumes one level of backslash. `\\` → `\`, `\'` → `'`. So to preserve a `\` in the output, you need `\\` in the source.

**How to apply:** After any change to inline `<script>` content inside a template literal, run:
```bash
curl -s $SERVER_URL/admin | python3 -c "
import sys, re
scripts = re.findall(r'<script[^>]*>(.*?)</script>', sys.stdin.read(), re.DOTALL)
open('/tmp/s.js','w').write('\n'.join(scripts))
" && node --check /tmp/s.js
```
This catches SyntaxErrors before deploy. The bug manifests as "POST request never reaches server" because the browser silently fails to define the fetch-calling function.
