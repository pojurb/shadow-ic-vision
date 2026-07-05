import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCodeIndex, CODE_INDEX_PATH, renderCodeIndex } from '@/scripts/context-index';
import { collectStatusErrors } from '@/scripts/status-check';

describe('repository status contracts', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-status-'));
    write('README.md', '[Active](ACTIVE_MILESTONE.md) [Checkpoint](SESSION_CHECKPOINT.md)');
    write('SESSION_CHECKPOINT.md', '# Checkpoint');
    write('ACTIVE_MILESTONE.md', 'Active Packet: [M001](docs/milestones/M001.md)');
    write('docs/milestones/M001.md', 'Status: `accepted`');
    write('docs/decisions/DEC-0001.md', '# DEC\n\nStatus: `accepted`');
    write('docs/decisions/INDEX.md', '| ID | Status | Record |\n|---|---|---|\n| DEC-0001 | `accepted` | [Decision](DEC-0001.md) |');
    write('docs/learning/candidates/LC-20260705-999-test.md', '# LC-20260705-999 - Test\n\nStatus: `promoted`');
    write('docs/learning/INDEX.md', '| LC-20260705-999 | `promoted` | quality |');
    write('docs/learning/PROMOTIONS.md', '| LC-20260705-999 | target |');
    write(CODE_INDEX_PATH, renderCodeIndex(buildCodeIndex(root)));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('accepts a consistent repository', () => expect(collectStatusErrors(root)).toEqual([]));

  it('reports missing milestone links and promotion mismatches', () => {
    write('ACTIVE_MILESTONE.md', 'Active Packet: [Missing](docs/milestones/missing.md)');
    write('docs/learning/PROMOTIONS.md', '# none');
    expect(collectStatusErrors(root)).toEqual(expect.arrayContaining([
      'ACTIVE_MILESTONE.md must link to an existing active packet.',
      'Promotion registry is missing LC-20260705-999.',
    ]));
  });

  it('reports decision status and generated-index drift', () => {
    write('docs/decisions/INDEX.md', '| ID | Status | Record |\n|---|---|---|\n| DEC-0001 | `proposed` | [Decision](DEC-0001.md) |');
    write('lib/new.ts', 'export const changed = true;');
    expect(collectStatusErrors(root)).toEqual(expect.arrayContaining([
      'Decision index status mismatch for DEC-0001.md: expected accepted.',
      'Generated code index is stale. Run npm run context:generate.',
    ]));
  });

  function write(relativePath: string, content: string) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
});
