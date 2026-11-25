import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "./pool";

async function migrate(): Promise<void> {
  const sql = await readFile(
    resolve(process.cwd(), "DataBase/migrations/001_auth_fields.sql"),
    "utf8",
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migración de autenticación aplicada.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  console.error("No se pudo aplicar la migración:", error);
  process.exitCode = 1;
});
