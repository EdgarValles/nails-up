// Usuaria única y sesiones de acceso, sobre MongoDB
const crypto = require("node:crypto");

const IDLE_MS = 7 * 864e5;
const MAX_MS = 30 * 864e5;
const TOUCH_MS = 60000;
const LOCK_AFTER = 5;
const LOCK_BASE_MS = 15 * 60000;
const LOCK_MAX_MS = 864e5;
const OWNER = "owner";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Una sesión vale si la usuaria existe y no pasó ningún límite de tiempo
function sessionValid(session, user, nowMs) {
  if (!session || !user) return false;
  const created = new Date(session.createdAt).getTime();
  const seen = new Date(session.lastSeenAt).getTime();
  if (nowMs - seen > IDLE_MS) return false;
  if (nowMs - created > MAX_MS) return false;
  if (user.passwordChangedAt && created < new Date(user.passwordChangedAt).getTime()) return false;
  return true;
}

// Calcula el nuevo estado de bloqueo tras un fallo
function applyFailure(user, nowMs) {
  const failed = (user.failedCount || 0) + 1;
  const lockCount = user.lockCount || 0;
  if (failed >= LOCK_AFTER) {
    const wait = Math.min(LOCK_BASE_MS * 2 ** lockCount, LOCK_MAX_MS);
    return { failedCount: 0, lockCount: lockCount + 1, lockedUntil: new Date(nowMs + wait) };
  }
  return { failedCount: failed, lockCount, lockedUntil: user.lockedUntil || null };
}

function createAuthStore(db, { now = Date.now } = {}) {
  const users = () => db.collection("users");
  const sessions = () => db.collection("sessions");
  const getUser = () => users().findOne({ _id: OWNER });
  let queue = Promise.resolve();

  return {
    async ensureIndexes() {
      await sessions().createIndex({ lastSeenAt: 1 }, { expireAfterSeconds: IDLE_MS / 1000 });
      await sessions().createIndex({ createdAt: 1 }, { expireAfterSeconds: MAX_MS / 1000 });
    },
    getUser,
    async createUser(passwordHash) {
      try {
        await users().insertOne({
          _id: OWNER, passwordHash, failedCount: 0, lockCount: 0,
          lockedUntil: null, passwordChangedAt: new Date(now()),
        });
      } catch (e) {
        if (e && e.code === 11000) throw new Error("Ya existe una usuaria.");
        throw e;
      }
    },
    async setPassword(passwordHash) {
      await users().updateOne({ _id: OWNER }, {
        $set: { passwordHash, passwordChangedAt: new Date(now()), failedCount: 0, lockCount: 0, lockedUntil: null },
      });
    },
    // Se encadenan los fallos para que ninguno se pierda en paralelo
    recordFailure() {
      const run = queue.then(async () => {
        const user = await getUser();
        if (!user) return null;
        const change = applyFailure(user, now());
        await users().updateOne({ _id: OWNER }, { $set: change });
        return { ...user, ...change };
      });
      queue = run.catch(() => {});
      return run;
    },
    async resetFailures() {
      await users().updateOne({ _id: OWNER }, { $set: { failedCount: 0, lockCount: 0 } });
    },
    async unlock() {
      await users().updateOne({ _id: OWNER }, { $set: { failedCount: 0, lockCount: 0, lockedUntil: null } });
    },
    async createSession() {
      const token = crypto.randomBytes(32).toString("base64url");
      const t = new Date(now());
      await sessions().insertOne({ _id: sha256(token), userId: OWNER, createdAt: t, lastSeenAt: t });
      return token;
    },
    async findSession(token) {
      if (typeof token !== "string" || token.length === 0 || token.length > 100) return null;
      const id = sha256(token);
      const session = await sessions().findOne({ _id: id });
      if (!session) return null;
      const t = now();
      if (!sessionValid(session, await getUser(), t)) {
        await sessions().deleteOne({ _id: id });
        return null;
      }
      if (t - new Date(session.lastSeenAt).getTime() > TOUCH_MS) {
        session.lastSeenAt = new Date(t);
        await sessions().updateOne({ _id: id }, { $set: { lastSeenAt: session.lastSeenAt } });
      }
      return session;
    },
    async deleteSession(token) {
      if (typeof token !== "string" || !token || token.length > 100) return;
      await sessions().deleteOne({ _id: sha256(token) });
    },
    async deleteAllSessions() {
      const r = await sessions().deleteMany({});
      return r.deletedCount;
    },
  };
}

module.exports = {
  createAuthStore, sessionValid, applyFailure,
  IDLE_MS, MAX_MS, TOUCH_MS, LOCK_AFTER, LOCK_BASE_MS, LOCK_MAX_MS,
};
