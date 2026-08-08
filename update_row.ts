import { getDatabase } from '@/db/client';

const hash = 'dd496b2d985d89057c0bcd4d9754f7975eb4b6eb16a690bbd8dd09f676c48789';
const db = getDatabase().sqlite;

// Get previous status
const prevRow = db.prepare('SELECT status, relative_path FROM knowledge_documents WHERE document_hash = ?').get(hash) as { status: string; relative_path: string } | undefined;
if (!prevRow) {
    console.error('Row not found');
    process.exit(1);
}

// Update row
const now = new Date().toISOString();
db.prepare(
    'UPDATE knowledge_documents SET status = ?, last_error = ?, error_code = ?, updated_at = ? WHERE document_hash = ?'
).run('awaiting_provider', null, null, now, hash);

// Verify
const newRow = db.prepare('SELECT status FROM knowledge_documents WHERE document_hash = ?').get(hash) as { status: string } | undefined;

console.log('Hash: ' + hash);
console.log('Source Path: ' + prevRow.relative_path);
console.log('Previous Status: ' + prevRow.status);
console.log('New Status: ' + newRow?.status);
