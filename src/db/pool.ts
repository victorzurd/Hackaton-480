import { Pool } from "pg";

export const pool = new Pool();

pool.on("error", (error) => {
  console.error("Error inesperado en la conexión con PostgreSQL:", error);
});
