import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import { verifyToken } from "./token";

/**
 * Middleware que exige una sesión de alumno válida.
 *
 * Comprueba el token Bearer y que la cuenta siga activa. Si todo es correcto,
 * deja el id del alumno en `response.locals.alumnoId` para las rutas
 * siguientes. Misma lógica que la de `routes/courses.ts`, separada para poder
 * reutilizarla en otros routers.
 */
export function requerirAlumno(db: Pool, jwtSecret: string) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const header = request.header("authorization");
    const match = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
    const claims = match ? verifyToken(match[1], jwtSecret) : null;
    if (!claims) {
      response.status(401).json({ error: "La sesión no es válida o ha caducado." });
      return;
    }

    try {
      const account = await db.query(
        `SELECT 1
         FROM academy.usuarios
         WHERE id = $1 AND activo = TRUE AND rol = 'alumno'
         LIMIT 1`,
        [claims.sub],
      );
      if (account.rowCount === 0) {
        response.status(401).json({ error: "La cuenta ya no está disponible." });
        return;
      }

      response.locals.alumnoId = claims.sub;
      next();
    } catch (error) {
      console.error("Error al validar la sesión del alumno:", error);
      response.status(500).json({ error: "No se pudo validar la sesión." });
    }
  };
}
