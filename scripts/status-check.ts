import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkCodeIndex } from './context-index';

export function collectStatusErrors(root: string): string[] {
  const errors: string[] = [];
  const read = (file: string) => fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';
  const active = read('ACTIVE_MILESTONE.md');
  const activeLink = active.match(/Active Packet:\s*\[[^\]]+\]\(([^)]+)\)/)?.[1];
  if (!activeLink || !fs.existsSync(path.join(root, activeLink))) errors.push('ACTIVE_MILESTONE.md must link to an existing active packet.');

  const readme = read('README.md');
  for (const target of ['ACTIVE_MILESTONE.md', 'SESSION_CHECKPOINT.md']) if (!readme.includes(`](${target})`)) errors.push(`README.md must link to ${target}.`);

  const decisionIndex = read('docs/decisions/INDEX.md');
  const decisionLinks = [...decisionIndex.matchAll(/\]\(([^)]+\.md)\)/g)].map((match) => match[1]);
  for (const link of decisionLinks) if (!fs.existsSync(path.join(root, 'docs', 'decisions', link))) errors.push(`Decision index target does not exist: ${link}`);
  for (const row of decisionIndex.split(/\r?\n/).filter((line) => /^\| (?:DEC|ADR)-/.test(line))) {
    const cells = row.split('|').map((cell) => cell.trim());
    const link = row.match(/\]\(([^)]+\.md)\)/)?.[1];
    if (!link) continue;
    const actual = read(path.posix.join('docs/decisions', link)).match(/^Status:\s*`([^`]+)`/m)?.[1];
    if (actual && cells[2] !== `\`${actual}\``) errors.push(`Decision index status mismatch for ${link}: expected ${actual}.`);
  }

  const learningIndex = read('docs/learning/INDEX.md');
  const promotions = read('docs/learning/PROMOTIONS.md');
  const candidateDirectory = path.join(root, 'docs', 'learning', 'candidates');
  if (fs.existsSync(candidateDirectory)) for (const name of fs.readdirSync(candidateDirectory).filter((file) => /^LC-.*\.md$/.test(file))) {
    const content = fs.readFileSync(path.join(candidateDirectory, name), 'utf8');
    const id = content.match(/^# (LC-\d+-\d+)/m)?.[1];
    const status = content.match(/^Status:\s*`([^`]+)`/m)?.[1];
    if (!id || !status) { errors.push(`Learning candidate is missing ID or status: ${name}`); continue; }
    const indexRow = learningIndex.split(/\r?\n/).find((line) => line.startsWith(`| ${id} |`));
    if (!indexRow) errors.push(`Learning index is missing ${id}.`);
    else if (!indexRow.includes(`| \`${status}\` |`)) errors.push(`Learning index status mismatch for ${id}.`);
    if (status === 'promoted' && !promotions.split(/\r?\n/).some((line) => line.startsWith(`| ${id} |`))) errors.push(`Promotion registry is missing ${id}.`);
  }

  errors.push(...checkCodeIndex(root));
  return errors;
}

async function main() {
  const errors = collectStatusErrors(process.cwd());
  if (errors.length) { process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`); process.exitCode = 1; }
  else process.stdout.write('Repository status contracts are consistent.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void main();
