import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCodeIndex, checkCodeIndex, CODE_INDEX_PATH, renderCodeIndex } from '@/scripts/context-index';

describe('deterministic code index', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-context-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('maps aliases, route methods, Drizzle tables, and test targets', () => {
    write('lib/domain/value.ts', 'export type Value = { id: string };\nexport const makeValue = () => ({ id: "1" });\n');
    write('app/api/items/route.ts', "import { makeValue } from '@/lib/domain/value';\nexport function GET() { return Response.json(makeValue()); }\nexport async function POST() {}\n");
    write('db/schema.ts', "import { sqliteTable, text } from 'drizzle-orm/sqlite-core';\nexport const items = sqliteTable('items', { id: text('id') });\n");
    write('tests/value.test.ts', "import { makeValue } from '@/lib/domain/value';\nvoid makeValue;\n");
    const index = buildCodeIndex(root);
    expect(index.modules.find((item) => item.path === 'app/api/items/route.ts')?.imports).toContainEqual({ specifier: '@/lib/domain/value', resolved: 'lib/domain/value.ts' });
    expect(index.routes).toContainEqual({ path: '/api/items', kind: 'route', module: 'app/api/items/route.ts', methods: ['GET', 'POST'] });
    expect(index.tables).toContainEqual({ name: 'items', symbol: 'items', module: 'db/schema.ts' });
    expect(index.tests[0].productionModules).toEqual(['lib/domain/value.ts']);
  });

  it('is deterministic and rejects stale generated output', () => {
    write('lib/value.ts', 'export const value = 1;\n');
    const first = buildCodeIndex(root);
    expect(renderCodeIndex(buildCodeIndex(root))).toBe(renderCodeIndex(first));
    write(CODE_INDEX_PATH, renderCodeIndex(first));
    expect(checkCodeIndex(root)).toEqual([]);
    write('lib/value.ts', 'export const value = 2;\n');
    expect(buildCodeIndex(root).sourceDigest).not.toBe(first.sourceDigest);
    expect(checkCodeIndex(root)).toEqual(['Generated code index is stale. Run npm run context:generate.']);
  });

  function write(relativePath: string, content: string) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
});
