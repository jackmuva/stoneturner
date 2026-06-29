import type { TursoDatabaseDatabase } from "drizzle-orm/tursodatabase/driver-core";
import { Database } from '@tursodatabase/database';

export type SqliteDb = TursoDatabaseDatabase & {
  $client: Database;
}
