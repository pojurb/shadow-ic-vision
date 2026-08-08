import { getDatabase } from '@/db/client';
const db = getDatabase().db;
const columns = getDatabase().sqlite.pragma('table_info(knowledge_documents)');
console.log(columns);
