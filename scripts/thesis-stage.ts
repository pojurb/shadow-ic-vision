#!/usr/bin/env node
/**
 * Stage a thesis draft for confirmation.
 * Creates a conversation + message with the draft, returns URL for user to confirm in browser.
 * Usage: npm run thesis:stage -- --draft '{"ticker":"TLKM",...}'
 * Or: cat draft.json | npm run thesis:stage
 * Output: JSON with { conversationId, url, clarificationNeeded, questions[] }
 */

import './dotenv-quiet';
import 'dotenv/config';

import { randomUUID } from 'crypto';
import { getDatabase } from '../db/client';
import { thesisDraftSchema, draftClarificationBlock } from '../lib/domain/contracts';
import { conversations, messages } from '../db/schema';

function parseArgs(args: string[]): { draft: string | null } {
  let draft: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--draft') {
      draft = args[index + 1] ?? null;
      index += 1;
    }
  }
  return { draft };
}

async function readStdin(): Promise<string> {
  let data = '';
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data;
}

async function main() {
  const { draft: draftArg } = parseArgs(process.argv.slice(2));

  let draftJson = draftArg ?? '';
  if (!draftJson && !process.stdin.isTTY) {
    draftJson = await readStdin();
  }
  if (!draftJson) throw new Error('Provide draft via --draft or stdin');

  const draftObj = JSON.parse(draftJson);
  const validated = thesisDraftSchema.safeParse(draftObj);
  if (!validated.success) {
    throw new Error(`Invalid draft schema: ${JSON.stringify(validated.error.format())}`);
  }
  const draft = validated.data;

  const clarification = draftClarificationBlock(draft);

  const { db } = getDatabase();
  const conversationId = randomUUID();
  const messageId = randomUUID();
  const nowIso = new Date().toISOString();

  await db.insert(conversations).values({
    id: conversationId,
    title: `Staged: ${draft.ticker} — ${draft.companyName}`,
    createdAt: nowIso,
    updatedAt: nowIso,
  }).run();

  await db.insert(messages).values({
    id: messageId,
    conversationId,
    role: 'assistant',
    content: 'Staged thesis draft.',
    structuredPayload: JSON.stringify(draft),
    validationOutcome: 'valid',
    createdAt: nowIso,
  }).run();

  const url = `http://localhost:3000/c/${conversationId}`;

  process.stdout.write(`${JSON.stringify({
    conversationId,
    url,
    clarificationNeeded: clarification.blocked,
    questions: clarification.questions,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
