// Read-only countercheck: restore only this batch's rendered contact functions
// in memory. Existing quiz/recovery changes in the working tree are preserved.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const app = path.join(root, 'projects');
const ts = require(path.join(app, 'node_modules/typescript'));
const htmlPath = path.join(app, 'public/project1-prototype-v9.html');
const scriptPath = path.join(app, 'scripts/test-preview-test-controls.ts');
const originalRead = fs.readFileSync;
let html = originalRead(htmlPath, 'utf8');
const previous = execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'show', 'HEAD:projects/public/project1-prototype-v9.html'], { cwd: root, encoding: 'utf8' });
for (const [start, end] of [['function personNode(', 'function renderPeople('], ['function renderComm(', 'function actionBtn(']]) {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  const oldFrom = previous.indexOf(start), oldTo = previous.indexOf(end, oldFrom);
  if ([from, to, oldFrom, oldTo].some(value => value < 0)) throw new Error(`Cannot locate ${start}`);
  html = html.slice(0, from) + previous.slice(oldFrom, oldTo) + html.slice(to);
}
fs.readFileSync = function (file, ...args) {
  if (path.resolve(String(file)) === htmlPath) return html;
  return originalRead.call(this, file, ...args);
};
const source = originalRead(scriptPath, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const testModule = new Module(scriptPath, module);
testModule.filename = scriptPath;
testModule.paths = Module._nodeModulePaths(path.dirname(scriptPath));
process.chdir(app);
console.log('Running existing test with this batch’s contact rendering restored in memory; expected existing snapshot assertion failure.');
testModule._compile(compiled, scriptPath);
