// Comandos de administración de la cuenta: node server/cli.js <comando>
const { hashPassword, validatePassword, MAX_PASSWORD } = require("./password.js");

const USAGE = [
  "Uso: node server/cli.js <comando>",
  "  crear-usuaria       crea la cuenta (solo la primera vez)",
  "  cambiar-contraseña  cambia la contraseña y cierra todas las sesiones",
  "  cerrar-sesiones     cierra todas las sesiones abiertas",
  "  desbloquear         quita el bloqueo por intentos fallidos",
].join("\n");

async function askNewPassword(readPassword) {
  const pw = await readPassword("Contraseña nueva: ");
  const again = await readPassword("Repite la contraseña: ");
  if (pw !== again) throw new Error("Las contraseñas no coinciden.");
  if (typeof pw !== "string" || pw.length < 12) throw new Error("La contraseña debe tener al menos 12 caracteres.");
  if (!validatePassword(pw)) throw new Error("La contraseña debe tener como máximo " + MAX_PASSWORD + " caracteres.");
  return pw;
}

async function runCommand(name, { authStore, readPassword, print }) {
  switch (name) {
    case "crear-usuaria": {
      if (await authStore.getUser()) throw new Error("Ya existe una usuaria. Usa cambiar-contraseña.");
      const pw = await askNewPassword(readPassword);
      await authStore.createUser(await hashPassword(pw));
      print("Usuaria creada.");
      return;
    }
    case "cambiar-contraseña": {
      if (!(await authStore.getUser())) throw new Error("No existe la usuaria. Usa crear-usuaria.");
      const pw = await askNewPassword(readPassword);
      await authStore.setPassword(await hashPassword(pw));
      print("Contraseña cambiada.");
      return;
    }
    case "cerrar-sesiones": {
      const n = await authStore.deleteAllSessions();
      print("Se cerraron " + n + " sesiones.");
      return;
    }
    case "desbloquear":
      await authStore.unlock();
      print("Cuenta desbloqueada.");
      return;
    default:
      print(USAGE);
  }
}

// Lee una contraseña sin mostrarla. Sin terminal interactiva, lee una línea normal.
function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    if (!stdin.isTTY) {
      const rl = require("node:readline").createInterface({ input: stdin });
      rl.once("line", (l) => { rl.close(); resolve(l); });
      rl.once("close", () => resolve(""));
      return;
    }
    let buf = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const done = (fn, v) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
      fn(v);
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done(resolve, buf);
        if (ch === "\u0003") return done(reject, new Error("Cancelado."));
        if (ch === "\u007f" || ch === "\b") buf = buf.slice(0, -1);
        else buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const { MongoClient } = require("mongodb");
  const { createAuthStore } = require("./auth-store.js");
  const { redactUri } = require("./mongo-store.js");
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGODB_DB || "nailsup";
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  let code = 0;
  try {
    try {
      await client.connect();
    } catch {
      throw new Error("No se pudo conectar a MongoDB en " + redactUri(uri) + ". Revisa que esté encendido.");
    }
    const authStore = createAuthStore(client.db(dbName));
    await authStore.ensureIndexes();
    await runCommand(process.argv[2], { authStore, readPassword: readHidden, print: console.log });
  } catch (e) {
    console.error(e.message);
    code = 1;
  }
  await client.close().catch(() => {});
  process.exit(code);
}

if (require.main === module) main();

module.exports = { runCommand, readHidden };
