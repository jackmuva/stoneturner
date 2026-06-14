import { drizzle } from 'drizzle-orm/tursodatabase/database';
import { Database } from '@tursodatabase/database';

const client = new Database('stoneturner.db');
export const db = drizzle({ client });
