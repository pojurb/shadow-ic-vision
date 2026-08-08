import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '@/db/client';
import {
  buildKnowledgeGraph,
  ensureKnowledgeArtifactLayout,
  extractKnowledgeSources,
  FileBackedKnowledgeProvider,
  processKnowledgeBatch,
  resolveKnowledgePaths,
  scanKnowledgeSources,
  writeKnowledgeReport,
} from '@/lib/knowledge';

async function main() {
  const command = process.argv[2];
  const paths = resolveKnowledgePaths(process.cwd());
  ensureKnowledgeArtifactLayout(paths);
  const database = getDatabase();

  try {
    if (command === 'scan') {
      const result = scanKnowledgeSources({
        db: database.db,
        sourceRoot: paths.sourceRoot,
        knowledgeRoot: paths.knowledgeRoot,
        manifestPath: paths.manifestPath,
      });
      printSafe({
        totalFiles: result.totalFiles,
        uniqueDocuments: result.uniqueDocuments,
        duplicates: result.duplicates,
        failedFiles: result.failedFiles,
        manifestPath: path.relative(paths.root, result.manifestPath),
      });
      return;
    }

    if (command === 'extract') {
      if (!fs.existsSync(paths.manifestPath)) {
        scanKnowledgeSources({
          db: database.db,
          sourceRoot: paths.sourceRoot,
          knowledgeRoot: paths.knowledgeRoot,
          manifestPath: paths.manifestPath,
        });
      }
      printSafe(await extractKnowledgeSources({
        db: database.db,
        sourceRoot: paths.sourceRoot,
        knowledgeRoot: paths.knowledgeRoot,
        force: process.argv.includes('--force'),
      }));
      return;
    }

    if (command === 'batch') {
      const providerName = process.env.KNOWLEDGE_PROVIDER?.trim();
      if (providerName && providerName !== 'file') {
        throw new Error('External knowledge providers are not enabled by the M012 CLI. Use KNOWLEDGE_PROVIDER=file for deterministic fixtures only.');
      }
      const provider = providerName === 'file'
        ? new FileBackedKnowledgeProvider(process.env.KNOWLEDGE_BATCH_INPUT_DIR || path.join(paths.batchesRoot, 'input'))
        : undefined;
      printSafe(await processKnowledgeBatch({
        db: database.db,
        knowledgeRoot: paths.knowledgeRoot,
        provider,
        force: process.argv.includes('--force'),
      }));
      return;
    }

    if (command === 'graph') {
      printSafe(await buildKnowledgeGraph({
        db: database.db,
        knowledgeRoot: paths.knowledgeRoot,
        graphRoot: paths.graphRoot,
        force: process.argv.includes('--force'),
      }));
      return;
    }

    if (command === 'report') {
      const reportPath = path.join(paths.reportsRoot, 'm012-report.json');
      const report = writeKnowledgeReport({
        db: database.db,
        manifestPath: paths.manifestPath,
        reportPath,
      });
      printSafe({ reportPath: paths.manifestPath ? path.relative(paths.root, reportPath) : reportPath, ...report });
      return;
    }

    throw new Error('Usage: knowledge.ts <scan|extract|batch|graph|report> [--force]');
  } finally {
    database.sqlite.close();
  }
}

function printSafe(value: unknown) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Knowledge command failed.'}\n`);
  process.exitCode = 1;
});
