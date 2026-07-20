import "dotenv/config";
import { readFile } from "node:fs/promises";

import { pool } from "../config/database.js";

const schemaFileUrl = new URL(
  "../database/schema.sql",
  import.meta.url,
);

async function setupDatabase() {
  try {
    console.log("Setting up Guess the What database...");

    const schema = await readFile(
      schemaFileUrl,
      "utf8",
    );

    await pool.query(schema);

    const tablesResult = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log("Database setup completed.");
    console.log("Tables:");

    tablesResult.rows.forEach((table) => {
      console.log(`- ${table.tablename}`);
    });
  } catch (error) {
    console.error("Database setup failed:");

    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setupDatabase();