#!/usr/bin/env node
/**
 * Stage a thesis draft for confirmation.
 * Creates a conversation + message with the draft, returns URL for user to confirm in browser.
 * Usage: cat draft.json | npm run thesis:stage
 * Or: npm run thesis:stage -- --draft '{"ticker":"TLKM",...}'
 * Output: JSON with { conversationId, url, clarificationNeeded, questions[] }
 */

import './dotenv-quiet';
import 'dotenv/config';

import { program } from 'commander';
import { getDatabase } from '../db/client';
import { thesisDraftSchema, draftClarificationBlock } from '../lib/domain/contracts';
import { conversations, messages } from '../db/schema';
import { randomUUID } from 'crypto';

const args = process.argv.slice(2);
program
  .option('--draft <json>', 'Thesis draft as JSON string')
  .parse(args);

const opts = program.opts() as { draft?: string };

async function readStdin(): Promise<string> {
  let data = '';
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data;
}

async function main() {
  try {
    const { db } = getDatabase();

    // Get draft from CLI argument or stdin
    let draftJson = '';
    if (opts.draft) {
      draftJson = opts.draft;
    } else if (!process.stdin.isTTY) {
      draftJson = await readStdin();
    }

    if (!draftJson) {
      console.error('Error: provide draft via --draft or stdin');
      process.exit(1);
    }

    const draftObj = JSON.parse(draftJson);
    const validated = thesisDraftSchema.safeParse(draftObj);

    if (!validated.success) {
      console.error('Invalid draft schema:', validated.error.format());
      process.exit(1);
    }

    const draft = validated.data;

    // Check for clarification requirements
    const clarification = draftClarificationBlock(draft);

    // Create synthetic conversation + message rows
    const conversationId = randomUUID();
    const messageId = randomUUID();

    await db.insert(conversations).values({
      id: conversationId,
      title: `Staged: ${draft.ticker} — ${draft.companyName}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).run();

    await db.insert(messages).values({
      id: messageId,
      conversationId,
      role: 'assistant',
      content: 'Staged thesis draft.',
      structuredPayload: JSON.stringify(draft),
      validationOutcome: 'valid',
      createdAt: new Date().toISOString(),
    }).run();

    const url = `http://localhost:3000/c/${conversationId}`;

    process.stdout.write(JSON.stringify({
      conversationId,
      url,
      clarificationNeeded: clarification.blocked,
      questions: clarification.questions.map(q => ({
        statement: q.statement,
        question: q.question,
        reason: q.reason,
      })),
    }, null, 2) + '\n');
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Failed to stage thesis.'}\n`);
    process.exitCode = 1;
  }
}

main();
