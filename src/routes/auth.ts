import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import type { Pool } from "pg";
import { hashPassword, verifyPassword } from "../security/password";
import { createToken, tokenLifetime, verifyToken } from "../security/token";

const MAYOR_EDAD = 18;

type AuthDependencies = {
  db: Pool;
  jwtSecret: string;
  dummyPasswordHash: string;
};

type UserRow = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  edad: number | null;
  bolsa_trabajo: boolean;
  password_hash: string;
};

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 250) return null;
  return normalized;
}

function emailAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    nombreCompleto: [user.nombre, user.apellidos].filter(Boolean).join(" "),
    correo: user.email,
    edad: user.edad,
    bolsaTrabajo: user.bolsa_trabajo,
  };
}

function bearerToken(request: Request): string | null {
  const header = request.header("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

export function createAuthRouter({ db, jwtSecret, dummyPasswordHash }: AuthDependencies) {
  const router = Router();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Espera unos minutos y vuelve a probar." },
  });

  router.post("/register", authLimiter, async (request: Request, response: Response) => {
    const body = request.body as Record<string, unknown> | undefined;
    const fullName = cleanName(body?.nombreCompleto);
    const email = emailAddress(body?.correo);
    const password = body?.contrasena;
    const age = body?.edad;
    const dataConsent = body?.consentimientoDatos;
    const jobPoolOptIn = body?.bolsaTrabajo;

    if (!fullName) {
      response.status(400).json({ error: "Escribe tu nombre completo." });
      return;
    }
    if (!email) {
      response.status(400).json({ error: "Escribe un correo electrónico válido." });
      return;
    }
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    ) {
      response.status(400).json({
        error: "La contraseña debe tener entre 12 y 128 caracteres.",
      });
      return;
    }
    if (
      typeof age !== "number" ||
      !Number.isInteger(age) ||
      age < 0 ||
      age > 120
    ) {
      response.status(400).json({ error: "La edad debe ser un número entre 0 y 120." });
      return;
    }
    if (dataConsent !== true) {
      response.status(400).json({
        error: "Debes aceptar el consentimiento para el tratamiento de datos.",
      });
      return;
    }
    if (jobPoolOptIn !== undefined && typeof jobPoolOptIn !== "boolean") {
      response.status(400).json({ error: "La preferencia de bolsa de trabajo no es válida." });
      return;
    }
    if (age < MAYOR_EDAD && jobPoolOptIn === true) {
      response.status(400).json({
        error: "La bolsa de trabajo está disponible solo para mayores de edad.",
      });
      return;
    }

    const [nombre, ...surnameParts] = fullName.split(" ");
    const apellidos = surnameParts.join(" ") || null;
    if (nombre.length > 100 || (apellidos && apellidos.length > 150)) {
      response.status(400).json({ error: "El nombre completo es demasiado largo." });
      return;
    }

    try {
      const passwordHash = await hashPassword(password);
      const result = await db.query<UserRow>(
        `INSERT INTO academy.usuarios
           (nombre, apellidos, email, password_hash, edad,
            consentimiento_datos, fecha_consentimiento_datos, bolsa_trabajo, rol)
         VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP, $6, 'alumno')
         RETURNING id::text, nombre, apellidos, email, edad, bolsa_trabajo`,
        [nombre, apellidos, email, passwordHash, age, jobPoolOptIn === true],
      );
      const user = result.rows[0];
      response.status(201).json({
        usuario: publicUser(user),
        token: createToken(user.id, jwtSecret),
        tipoToken: "Bearer",
        expiraEn: tokenLifetime,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        response.status(409).json({ error: "Ya existe una cuenta con ese correo." });
        return;
      }
      console.error("Error al crear la cuenta:", error);
      response.status(500).json({ error: "No se pudo crear la cuenta." });
    }
  });

  router.post("/login", authLimiter, async (request: Request, response: Response) => {
    const body = request.body as Record<string, unknown> | undefined;
    const email = emailAddress(body?.correo);
    const password = body?.contrasena;
    if (!email || typeof password !== "string" || password.length > 128) {
      response.status(401).json({ error: "Correo o contraseña incorrectos." });
      return;
    }

    try {
      const result = await db.query<UserRow>(
        `SELECT id::text, nombre, apellidos, email, edad, bolsa_trabajo, password_hash
         FROM academy.usuarios
         WHERE email = $1 AND activo = TRUE AND rol = 'alumno'
         LIMIT 1`,
        [email],
      );
      const user = result.rows[0];
      const valid = await verifyPassword(
        password,
        user?.password_hash ?? dummyPasswordHash,
      );
      if (!user || !valid) {
        response.status(401).json({ error: "Correo o contraseña incorrectos." });
        return;
      }

      response.json({
        usuario: publicUser(user),
        token: createToken(user.id, jwtSecret),
        tipoToken: "Bearer",
        expiraEn: tokenLifetime,
      });
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      response.status(500).json({ error: "No se pudo iniciar sesión." });
    }
  });

  router.get("/me", async (request: Request, response: Response) => {
    const token = bearerToken(request);
    const claims = token ? verifyToken(token, jwtSecret) : null;
    if (!claims) {
      response.status(401).json({ error: "La sesión no es válida o ha caducado." });
      return;
    }

    try {
      const result = await db.query<UserRow>(
        `SELECT id::text, nombre, apellidos, email, edad, bolsa_trabajo, '' AS password_hash
         FROM academy.usuarios
         WHERE id = $1 AND activo = TRUE AND rol = 'alumno'
         LIMIT 1`,
        [claims.sub],
      );
      const user = result.rows[0];
      if (!user) {
        response.status(401).json({ error: "La cuenta ya no está disponible." });
        return;
      }
      response.json({ usuario: publicUser(user) });
    } catch (error) {
      console.error("Error al consultar la cuenta:", error);
      response.status(500).json({ error: "No se pudo consultar la cuenta." });
    }
  });

  return router;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
