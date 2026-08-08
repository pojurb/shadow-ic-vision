import fs from 'node:fs';
import path from 'node:path';

export type KnowledgePaths = {
  root: string;
  sourceRoot: string;
  knowledgeRoot: string;
  manifestPath: string;
  extractedRoot: string;
  batchesRoot: string;
  reportsRoot: string;
  graphRoot: string;
};

export function resolveKnowledgePaths(root = process.cwd()): KnowledgePaths {
  const sourceRoot = path.join(root, 'originals');
  const knowledgeRoot = path.join(root, 'private', 'knowledge');
  return {
    root,
    sourceRoot,
    knowledgeRoot,
    manifestPath: path.join(knowledgeRoot, 'manifest.jsonl'),
    extractedRoot: path.join(knowledgeRoot, 'extracted'),
    batchesRoot: path.join(knowledgeRoot, 'batches'),
    reportsRoot: path.join(knowledgeRoot, 'reports'),
    graphRoot: path.join(knowledgeRoot, 'graph'),
  };
}

export function ensureKnowledgeArtifactLayout(paths: KnowledgePaths) {
  if (!fs.existsSync(paths.sourceRoot) || !fs.statSync(paths.sourceRoot).isDirectory()) {
    throw new Error(`Knowledge source archive is missing: ${path.relative(paths.root, paths.sourceRoot)}`);
  }
  for (const directory of [paths.knowledgeRoot, paths.extractedRoot, paths.batchesRoot, paths.reportsRoot, paths.graphRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export function toSourceRelativePath(sourceRoot: string, absolutePath: string): string {
  const relative = path.relative(sourceRoot, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Source path escapes originals/: ${absolutePath}`);
  }
  return relative.split(path.sep).join('/');
}

export function resolveSourcePath(sourceRoot: string, relativePath: string): string {
  const absolute = path.resolve(sourceRoot, relativePath);
  const relative = path.relative(path.resolve(sourceRoot), absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Source path escapes originals/: ${relativePath}`);
  }
  return absolute;
}

export function artifactRelativePath(knowledgeRoot: string, absolutePath: string): string {
  return path.relative(knowledgeRoot, absolutePath).split(path.sep).join('/');
}
