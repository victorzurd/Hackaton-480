import { createHmac, timingSafeEqual } from "node:crypto";

const ISSUER = "480-academy-api";
const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;

export type AuthClaims = {
  sub: string;
  role: "alumno";
  iat: number;
  exp: number;
  iss: string;
};

function toBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function sign(content: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(content).digest();
}

export function createToken(userId: string, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: userId,
      role: "alumno",
      iat: now,
      exp: now + TOKEN_LIFETIME_SECONDS,
      iss: ISSUER,
    }),
  );
  const content = `${header}.${payload}`;
  return `${content}.${sign(content, secret).toString("base64url")}`;
}

export function verifyToken(token: string, secret: string): AuthClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  const content = `${headerPart}.${payloadPart}`;
  const actualSignature = Buffer.from(signaturePart, "base64url");
  const expectedSignature = sign(content, secret);
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const header = JSON.parse(
      Buffer.from(headerPart, "base64url").toString("utf8"),
    ) as { alg?: string; typ?: string };
    const claims = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as Partial<AuthClaims>;

    if (
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      claims.iss !== ISSUER ||
      claims.role !== "alumno" ||
      typeof claims.sub !== "string" ||
      !/^\d+$/.test(claims.sub) ||
      typeof claims.exp !== "number" ||
      claims.exp <= Math.floor(Date.now() / 1000) ||
      typeof claims.iat !== "number"
    ) {
      return null;
    }

    return claims as AuthClaims;
  } catch {
    return null;
  }
}

export const tokenLifetime = "8h";
