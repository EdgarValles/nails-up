const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 1024;

// Contraseña válida: texto de 12 a 1024 caracteres
function validatePassword(pw) {
  return typeof pw === "string" && pw.length >= MIN_PASSWORD && pw.length <= MAX_PASSWORD;
}

async function hashPassword(pw) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = await scrypt(pw, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function verifyPassword(pw, stored) {
  try {
    if (typeof pw !== "string" || typeof stored !== "string") return false;
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    // Solo aceptamos los parámetros esperados, para no aceptar costos absurdos
    if (Number(parts[1]) !== N || Number(parts[2]) !== R || Number(parts[3]) !== P) return false;
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    if (salt.length !== SALT_BYTES || expected.length !== KEYLEN) return false;
    const actual = await scrypt(pw, salt, KEYLEN, { N, r: R, p: P });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, validatePassword, MAX_PASSWORD };
