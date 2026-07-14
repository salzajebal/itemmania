const fs = require('fs');
const src = fs.readFileSync('artifacts/api-server/src/admin-script.js', 'utf8');
const escaped = src.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const out = 'export const ADMIN_SCRIPT_CONTENT = `' + escaped + '`;\n';
fs.writeFileSync('artifacts/api-server/src/admin-script-content.ts', out);
console.log('OK', out.length, 'chars');
