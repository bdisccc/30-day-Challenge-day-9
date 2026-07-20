import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing from the server .env file.",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("connect", () => {
  console.log("PostgreSQL client connected.");
});

pool.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL pool error:",
    error,
  );
});

export async function checkDatabaseConnection() {
  const result = await pool.query(`
    SELECT
      NOW() AS database_time,
      current_database() AS database_name
  `);

  return result.rows[0];
}