import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

export type SqliteDb = BaseSQLiteDatabase<"async", any, any>;
