import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export const CODE_INDEX_PATH = path.join('docs', 'generated', 'code-index.json');
const ROOTS = ['app', 'components', 'lib', 'db', 'tests'];
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export type CodeIndex = {
  schemaVersion: 1;
  sourceDigest: string;
  roots: string[];
  modules: Array<{ path: string; kind: string; imports: Array<{ specifier: string; resolved: string | null }>; exports: string[] }>;
  routes: Array<{ path: string; kind: 'page' | 'route'; module: string; methods: string[] }>;
  tables: Array<{ name: string; symbol: string; module: string }>;
  tests: Array<{ path: string; productionModules: string[] }>;
};

export function buildCodeIndex(rootDirectory: string): CodeIndex {
  const files = ROOTS.flatMap((root) => walk(path.join(rootDirectory, root)))
    .filter((file) => /\.(?:ts|tsx)$/.test(file) && !file.endsWith('.d.ts'))
    .sort();
  const relativeFiles = new Set(files.map((file) => relative(rootDirectory, file)));
  const modules = files.map((file) => inspectModule(rootDirectory, file, relativeFiles));
  const routes = modules.flatMap((module) => inspectRoute(module.path, module.exports));
  const tables = files.flatMap((file) => inspectTables(rootDirectory, file));
  const tests = modules.filter((module) => module.kind === 'test').map((module) => ({
    path: module.path,
    productionModules: module.imports.flatMap((item) => item.resolved && !item.resolved.startsWith('tests/') ? [item.resolved] : []).sort(),
  }));
  const hash = crypto.createHash('sha256');
  hash.update('code-index-schema:1\0');
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
    hash.update(`${relative(rootDirectory, file)}\0${source}\0`);
  }
  return { schemaVersion: 1, sourceDigest: hash.digest('hex'), roots: [...ROOTS], modules, routes, tables, tests };
}

export function renderCodeIndex(index: CodeIndex) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function checkCodeIndex(rootDirectory: string): string[] {
  const target = path.join(rootDirectory, CODE_INDEX_PATH);
  if (!fs.existsSync(target)) return [`Missing generated code index: ${CODE_INDEX_PATH}`];
  const expected = renderCodeIndex(buildCodeIndex(rootDirectory));
  return fs.readFileSync(target, 'utf8') === expected ? [] : [`Generated code index is stale. Run npm run context:generate.`];
}

function inspectModule(root: string, file: string, files: Set<string>) {
  const modulePath = relative(root, file);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports: Array<{ specifier: string; resolved: string | null }> = [];
  const exports = new Set<string>();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      imports.push({ specifier, resolved: resolveImport(modulePath, specifier, files) });
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) ?? [] : [];
    if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) exports.add(statement.name.text);
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) exports.add(declaration.name.text);
      if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) exports.add('default');
    }
    if (ts.isExportAssignment(statement)) exports.add('default');
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const item of statement.exportClause.elements) exports.add(item.name.text);
      else exports.add('*');
    }
  }
  return { path: modulePath, kind: moduleKind(modulePath), imports: imports.sort((a, b) => a.specifier.localeCompare(b.specifier)), exports: [...exports].sort() };
}

function inspectRoute(modulePath: string, exports: string[]): CodeIndex['routes'] {
  if (!modulePath.startsWith('app/')) return [];
  const basename = path.posix.basename(modulePath);
  if (!['page.ts', 'page.tsx', 'route.ts', 'route.tsx'].includes(basename)) return [];
  const routePath = `/${path.posix.dirname(modulePath).replace(/^app\/?/, '').split('/').filter((part) => part && !/^\(.+\)$/.test(part)).join('/')}`.replace(/\/$/, '') || '/';
  return [{ path: routePath, kind: basename.startsWith('page.') ? 'page' : 'route', module: modulePath, methods: exports.filter((item) => HTTP_METHODS.has(item)).sort() }];
}

function inspectTables(root: string, file: string): CodeIndex['tables'] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const results: CodeIndex['tables'] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer)) {
      const expression = node.initializer.expression;
      if (ts.isIdentifier(expression) && expression.text === 'sqliteTable') {
        const first = node.initializer.arguments[0];
        if (first && ts.isStringLiteral(first)) results.push({ name: first.text, symbol: node.name.text, module: relative(root, file) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function resolveImport(from: string, specifier: string, files: Set<string>) {
  let base: string | null = null;
  if (specifier.startsWith('@/')) base = specifier.slice(2);
  else if (specifier.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (files.has(candidate)) return candidate;
  return null;
}

function moduleKind(file: string) {
  if (/\.test\.(?:ts|tsx)$/.test(file) || file.startsWith('tests/')) return 'test';
  if (/app\/.+\/route\.(?:ts|tsx)$/.test(file)) return 'route';
  if (/app\/(?:.+\/)?page\.(?:ts|tsx)$/.test(file)) return 'page';
  if (file.startsWith('components/')) return 'component';
  if (file === 'db/schema.ts') return 'schema';
  return 'module';
}

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}

function relative(root: string, file: string) { return path.relative(root, file).replaceAll('\\', '/'); }

async function main() {
  const root = process.cwd();
  if (process.argv.includes('--check')) {
    const errors = checkCodeIndex(root);
    if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; }
    else process.stdout.write('Code index is current.\n');
    return;
  }
  const target = path.join(root, CODE_INDEX_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderCodeIndex(buildCodeIndex(root)), 'utf8');
  process.stdout.write(`Generated ${CODE_INDEX_PATH}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void main();
