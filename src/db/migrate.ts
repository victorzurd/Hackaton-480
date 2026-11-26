import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "./pool";

async function migrate(): Promise<void> {
  const migrationSql = await readFile(
    resolve(process.cwd(), "DataBase/migrations/001_auth_fields.sql"),
    "utf8",
  );
  const seedSql = await readFile(
    resolve(process.cwd(), "DataBase/seeds/cs50p_demo.sql"),
    "utf8",
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(migrationSql);
    await client.query(seedSql);
    // El seed establece search_path para sus consultas; no lo dejamos
    // modificado en la conexión que vuelve al pool.
    await client.query("RESET search_path");
    await client.query("COMMIT");
    console.log("Migración aplicada y curso CS50P de prueba cargado.");
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
