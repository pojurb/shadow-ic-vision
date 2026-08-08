import { getDatabase } from '@/db/client';
const database = getDatabase();
database.sqlite.prepare("UPDATE knowledge_documents SET status = 'extracted', error_code = NULL, last_error = NULL WHERE status = 'failed'").run();
console.log('Database updated.');
