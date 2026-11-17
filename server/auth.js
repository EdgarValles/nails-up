// Entrar y salir del portal con contraseña, y la sesión obligatoria para el resto
const express = require("express");
const { verifyPassword, MAX_PASSWORD } = require("./password");

const COOKIE = "nu_session";
const MAX_AGE = 2592000; // 30 días, en segundos
const MAX_TOKEN = 100;

const MSG = {
  empty: "Escribe tu contraseña.",
  wrong: "Contraseña incorrecta",
  limited: "Demasiados intentos. Intenta más tarde.",
  loginError: "No se pudo iniciar sesión. Intenta de nuevo.",
  expired: "Tu sesión terminó. Vuelve a entrar.",
  sessionError: "No se pudo verificar tu sesión. Intenta de nuevo.",
  logoutError: "No se pudo cerrar la sesión. Intenta de nuevo.",
};
const lockedMsg = (ms) => `Demasiados intentos. Intenta en ${Math.max(1, Math.ceil(ms / 60000))} minutos.`;

// Una línea JSON por evento; nunca lleva contraseña, token ni cookie
function defaultLog(entry) {
  console.log(JSON.stringify({ t: entry.t, ip: entry.ip, event: entry.event }));
}

// Ventana deslizante por clave: false a partir del intento max + 1 dentro de la ventana
function createRateLimiter({ max = 20, windowMs = 900000, now = Date.now } = {}) {
  const hits = new Map();
  const prune = (list, t) => { while (list.length && t - list[0] >= windowMs) list.shift(); };
  return {
    hit(key) {
      const t = now();
      if (hits.size > 10000) {
        for (const [k, list] of hits) { prune(list, t); if (!list.length) hits.delete(k); }
      }
      const list = hits.get(key) || [];
      prune(list, t);
      hits.set(key, list);
      if (list.length >= max) return false;
      list.push(t);
      return true;
    },
  };
}

// Lector propio de la cabecera Cookie: solo vale una única nu_session no vacía y corta
function readToken(req) {
  const header = req.headers.cookie;
  if (typeof header !== "string" || !header) return null;
  let found = null;
  let count = 0;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== COOKIE) continue;
    count++;
    found = part.slice(i + 1).trim();
  }
  if (count !== 1 || !found || found.length > MAX_TOKEN) return null;
  return found;
}

function createAuth({ authStore, now = Date.now, secure = false, log = defaultLog } = {}) {
  const limiter = createRateLimiter({ now });
  const attrs = "; HttpOnly; SameSite=Strict; Path=/" + (secure ? "; Secure" : "");
  const setCookie = (res, token) => res.append("Set-Cookie", `${COOKIE}=${token}${attrs}; Max-Age=${MAX_AGE}`);
  const clearCookie = (res) => res.append("Set-Cookie", `${COOKIE}=${attrs}; Max-Age=0`);
  const emit = (req, event) => {
    try { log({ t: new Date(now()).toISOString(), ip: String(req.ip || ""), event }); } catch { /* el log no debe tumbar el login */ }
  };
  const lockedFor = (user) => {
    const until = user && user.lockedUntil ? new Date(user.lockedUntil).getTime() : 0;
    return until - now();
  };

  async function currentSession(req) {
    const token = readToken(req);
    if (!token) return null;
    return (await authStore.findSession(token)) || null;
  }

  async function requireSession(req, res, next) {
    const isApi = req.originalUrl === "/api" || req.originalUrl.startsWith("/api/");
    let session;
    try {
      session = await currentSession(req);
    } catch {
      if (isApi) return res.status(500).json({ error: MSG.sessionError });
      return res.status(500).type("text").send(MSG.sessionError);
    }
    if (!session) {
      if (isApi) return res.status(401).json({ error: MSG.expired });
      return res.redirect(302, "/login");
    }
    req.session = session;
    next();
  }

  const router = express.Router();
  const noStore = (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); };
  const limit = (req, res, next) => {
    if (limiter.hit(String(req.ip || ""))) return next();
    emit(req, "login_limited");
    res.status(429).json({ error: MSG.limited });
  };
  const body = express.json({ limit: "4kb", type: "application/json" });
  // JSON roto, demasiado grande o de otro tipo: se trata igual que un cuerpo vacío
  const bodyError = (_err, _req, res, _next) => res.status(400).json({ error: MSG.empty });

  router.post("/login", noStore, limit, body, bodyError);
  router.post("/login", async (req, res) => {
    const b = req.body;
    const password = b && typeof b === "object" && !Array.isArray(b) ? b.password : undefined;
    if (typeof password !== "string" || !password || password.length > MAX_PASSWORD) {
      return res.status(400).json({ error: MSG.empty });
    }
    try {
      const user = await authStore.getUser();
      if (!user) {
        emit(req, "login_fail");
        return res.status(401).json({ error: MSG.wrong });
      }
      const wait = lockedFor(user);
      if (wait > 0) {
        emit(req, "login_locked");
        return res.status(429).json({ error: lockedMsg(wait) });
      }
      if (!(await verifyPassword(password, user.passwordHash))) {
        const updated = await authStore.recordFailure();
        emit(req, "login_fail");
        const left = lockedFor(updated);
        if (left > 0) return res.status(429).json({ error: lockedMsg(left) });
        return res.status(401).json({ error: MSG.wrong });
      }
      await authStore.resetFailures();
      const token = await authStore.createSession();
      setCookie(res, token);
      emit(req, "login_ok");
      res.status(204).end();
    } catch {
      res.status(500).json({ error: MSG.loginError });
    }
  });

  router.post("/logout", noStore, async (req, res) => {
    clearCookie(res);
    const token = readToken(req);
    try {
      if (token) await authStore.deleteSession(token);
    } catch {
      return res.status(500).json({ error: MSG.logoutError });
    }
    res.status(204).end();
  });

  return { router, requireSession, currentSession };
}

module.exports = { createAuth, createRateLimiter, defaultLog, readToken, COOKIE };
