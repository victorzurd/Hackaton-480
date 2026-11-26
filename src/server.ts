import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pool } from "./db/pool";
import { createAuthRouter } from "./routes/auth";
import { createCoursesRouter } from "./routes/courses";
import { createReelsRouter } from "./routes/reels";
import { hashPassword } from "./security/password";

const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.AUTH_JWT_SECRET ?? "";
const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT debe ser un número entre 1 y 65535.");
}
if (Buffer.byteLength(jwtSecret, "utf8") < 32) {
  throw new Error("AUTH_JWT_SECRET debe tener al menos 32 bytes.");
}

const app = express();
app.disable("x-powered-by");
// Detrás del proxy HTTPS (Caddy) la API recibe HTTP: confía en su X-Forwarded-Proto
// para saber que la petición original era HTTPS. Solo desde direcciones locales o privadas.
app.set("trust proxy", "loopback, uniquelocal");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        styleSrcElem: ["'self'"],
        // El prototipo se sirve por HTTP en la red local; aún no hay TLS configurado.
        upgradeInsecureRequests: null,
      },
    },
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use((request: Request, response: Response, next: NextFunction) => {
  const origin = request.header("origin");
  const requestOrigin = `${request.protocol}://${request.get("host")}`;
  const isSameOrigin = origin === requestOrigin;
  if (origin && !isSameOrigin && !allowedOrigins.includes(origin)) {
    response.status(403).json({ error: "Este origen no está permitido." });
    return;
  }
  if (origin && !isSameOrigin && allowedOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  }
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});

app.use(express.static(resolve(process.cwd(), "web")));
app.use("/media", express.static(resolve(process.cwd(), "media")));

app.get("/health", async (_request: Request, response: Response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ estado: "ok" });
  } catch {
    response.status(503).json({ estado: "sin_conexion_a_base_de_datos" });
  }
});

async function start(): Promise<void> {
  await pool.query("SELECT 1");
  const dummyPasswordHash = await hashPassword(randomBytes(32).toString("hex"));
  app.use(
    "/api/auth",
    createAuthRouter({ db: pool, jwtSecret, dummyPasswordHash }),
  );
  app.use("/api/courses", createCoursesRouter({ db: pool, jwtSecret }));
  app.use("/api/reels", createReelsRouter({ db: pool, jwtSecret }));

  app.use((request: Request, response: Response) => {
    response.status(404).json({ error: "No se encontró el recurso solicitado." });
  });
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    console.error("Error no controlado:", error);
    response.status(500).json({ error: "Ha ocurrido un error interno." });
  });

  const server = app.listen(port, () => {
    console.log(`API de 480 Academy escuchando en el puerto ${port}.`);
  });

  const shutdown = () => {
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

start().catch((error: unknown) => {
  console.error("No se pudo iniciar la API:", error);
  process.exitCode = 1;
  void pool.end();
});
