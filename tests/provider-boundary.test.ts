import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCANNED_DIRECTORIES = ['app', 'components', 'lib', 'scripts'];
const PROVIDER_ENDPOINT_PATTERN = /fetch\(\s*['"`](?:https?:\/\/|[^'"`]*(?:ollama|openai|anthropic|gemini|google))/i;

describe('provider boundary', () => {
  it('keeps provider endpoint fetches behind the project-owned AI boundary', () => {
    const offenders = listSourceFiles(process.cwd(), SCANNED_DIRECTORIES)
      .filter((filePath) => PROVIDER_ENDPOINT_PATTERN.test(fs.readFileSync(filePath, 'utf8')))
      .map((filePath) => path.normalize(path.relative(process.cwd(), filePath)))
      .filter((relativePath) => relativePath !== path.normalize('lib/ai/provider-http.ts'));

    expect(offenders).toEqual([]);
  });

  it('does not import provider SDKs in product code', () => {
    const sdkImportPattern = /from ['"](?:ai|@ai-sdk\/[^'"]+)['"]/;
    const offenders = listSourceFiles(process.cwd(), SCANNED_DIRECTORIES)
      .filter((filePath) => sdkImportPattern.test(fs.readFileSync(filePath, 'utf8')))
      .map((filePath) => path.normalize(path.relative(process.cwd(), filePath)));

    expect(offenders).toEqual([]);
  });
});

function listSourceFiles(root: string, directories: string[]) {
  return directories.flatMap((directory) => walk(path.join(root, directory)));
}

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}
