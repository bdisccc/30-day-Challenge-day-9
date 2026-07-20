import "dotenv/config";
import { readFile } from "node:fs/promises";

import { pool } from "../config/database.js";

async function setupMultiplayerUpgrade() {
  try {
    const sqlPath = new URL(
      "../database/multiplayerUpgrade.sql",
      import.meta.url,
    );

    const sql = await readFile(
      sqlPath,
      "utf8",
    );

    await pool.query(sql);

    console.log(
      "Multiplayer upgrade tables created successfully.",
    );
  } catch (error) {
    console.error(
      "Unable to apply the multiplayer database upgrade:",
      error,
    );

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setupMultiplayerUpgrade();