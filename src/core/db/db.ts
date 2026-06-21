import { drizzle } from 'drizzle-orm/tursodatabase/database';
import { Database } from '@tursodatabase/database';

const client = new Database(process.env.BUN_PUBLIC_DEV_MODE === "false" ? 'stoneturner.db' : "test-stoneturner.db");
export const db = drizzle({ client });
