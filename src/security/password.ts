import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELIZATION,
        maxmem: MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt);
  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, saltText, keyText, extra] =
    storedHash.split("$");

  if (
    algorithm !== "scrypt" ||
    cost !== String(COST) ||
    blockSize !== String(BLOCK_SIZE) ||
    parallelization !== String(PARALLELIZATION) ||
    !saltText ||
    !keyText ||
    extra !== undefined
  ) {
    return false;
  }

  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(keyText, "base64url");
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return false;

  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}
