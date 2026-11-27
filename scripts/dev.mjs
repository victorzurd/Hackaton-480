import { spawn } from "node:child_process";
import { resolve } from "node:path";

const child = spawn(
  process.execPath,
  [resolve("node_modules/tsx/dist/cli.mjs"), "watch", "src/server.ts"],
  {
    env: { ...process.env, NODE_ENV: "development" },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error("No se pudo iniciar el servidor de desarrollo:", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 0 : 1);
});

process.once("SIGINT", () => child.kill("SIGINT"));
process.once("SIGTERM", () => child.kill("SIGTERM"));
