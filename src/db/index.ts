import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/schema";
import * as relations from "../drizzle/relations";
import "dotenv/config";

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,  // Required for Supabase transaction pooling
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(client, {
  schema: {
    ...schema,
    ...relations,
  },
});
