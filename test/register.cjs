// Test-only TypeScript loader. Production continues to use Next's compiler.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};
const originalLoad = Module._load;
Module._load = function (id, parent, isMain) {
  if (id.startsWith('@/')) id = path.join(__dirname, '..', id.slice(2)) + '.ts';
  return originalLoad.call(this, id, parent, isMain);
};
