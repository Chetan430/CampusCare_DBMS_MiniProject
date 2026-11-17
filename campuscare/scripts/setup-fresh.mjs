// Cross-platform, non-destructive fresh setup. Does not change the legacy
// "campuscare" database or its postgres password.
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const container = "campuscare-db";
const database = "campuscare_final";
const role = "campuscare_final_user";
const envFile = join(root, ".env");
const psql = (db, sql, quiet = false) => {
  const args = ["exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", db];
  if (quiet) args.push("-tAc", sql);
  else args.push("-c", sql);
  return execFileSync("docker", args, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"], timeout: 60000 }).trim();
};
const sqlFile = (file) => {
  const sql = readFileSync(join(root, "sql", file));
  console.log(`  Applying ${file}`);
  execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], {
    cwd: root, input: sql, stdio: ["pipe", "inherit", "inherit"], timeout: 120000,
  });
};
const run = (command) => {
  console.log(`\n> ${command}`);
  const result = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", command], { cwd: root, stdio: "inherit" })
    : spawnSync("sh", ["-c", command], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed (${result.status}): ${command}`);
};
const getOldSetting = (key) => {
  if (!existsSync(envFile)) return null;
  const match = readFileSync(envFile, "utf8").match(new RegExp(`^${key}\\s*=\\s*["']?([^"'\\r\\n]+)`, "m"));
  return match?.[1] ?? null;
};

try {
  console.log("\n=== CampusCare clean Level 3 setup ===");
  console.log("This creates a NEW database named campuscare_final. Your old database is not modified.\n");
  let exists = false;
  try {
    execFileSync("docker", ["inspect", container], { stdio: "ignore", timeout: 15000 });
    exists = true;
  } catch { /* container does not exist */ }
  if (exists) {
    console.log("Starting the existing campuscare-db container (if stopped)...");
    const running = execFileSync("docker", ["inspect", "-f", "{{.State.Running}}", container], { encoding: "utf8" }).trim();
    if (running !== "true") execFileSync("docker", ["start", container], { stdio: "inherit" });
  } else {
    console.log("No campuscare-db container found. Starting Docker Compose...");
    run("docker compose up -d");
  }
  // Wait for the local database to accept connections.
  let ready = false;
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      execFileSync("docker", ["exec", container, "pg_isready", "-U", "postgres", "-d", "postgres"], { stdio: "ignore", timeout: 5000 });
      ready = true; break;
    } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  if (!ready) throw new Error("PostgreSQL container did not become ready. Open Docker Desktop and try again.");

  // This role is exclusive to the clean project. No changes to the legacy postgres password.
  const oldUrl = getOldSetting("DATABASE_URL");
  let password = randomBytes(24).toString("hex");
  if (oldUrl) {
    try {
      const parsed = new URL(oldUrl);
      if (parsed.username === role && parsed.password) password = decodeURIComponent(parsed.password);
    } catch { /* replace an invalid local .env */ }
  }
  console.log("Creating/validating the dedicated database user...");
  psql("postgres", `DO $cc$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role} LOGIN; END IF; END $cc$;`);
  psql("postgres", `ALTER ROLE ${role} WITH LOGIN PASSWORD '${password}';`);
  if (psql("postgres", `SELECT 1 FROM pg_database WHERE datname='${database}';`, true) !== "1") {
    console.log(`Creating database ${database}...`);
    psql("postgres", `CREATE DATABASE ${database} OWNER ${role};`);
  }
  psql("postgres", `ALTER DATABASE ${database} OWNER TO ${role};`);
  psql(database, "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto;");
  psql(database, `GRANT USAGE, CREATE ON SCHEMA public TO ${role};`);

  // Fresh session secret on first run, preserved on reruns.
  const secret = getOldSetting("NEXTAUTH_SECRET");
  const nextSecret = secret && secret.length >= 32 && !secret.includes("REPLACE") && !secret.includes("SET_BY_SETUP")
    ? secret : randomBytes(32).toString("hex");
  const demoPassword = getOldSetting("DEMO_PASSWORD") ?? "password123";
  const mode = getOldSetting("EMBEDDING_MODE") ?? "auto";
  const timeout = getOldSetting("EMBEDDING_TIMEOUT_MS") ?? "8000";
  const url = `postgresql://${role}:${encodeURIComponent(password)}@localhost:5432/${database}`;
  writeFileSync(envFile,
    `DATABASE_URL="${url}"\nNEXTAUTH_URL="http://localhost:3100"\nNEXTAUTH_SECRET="${nextSecret}"\nDEMO_PASSWORD="${demoPassword}"\nEMBEDDING_MODE="${mode}"\nEMBEDDING_TIMEOUT_MS="${timeout}"\n`,
    { mode: 0o600 });
  console.log("Created .env with a dedicated login and port 3100. Password is not printed.");

  run("npx prisma db push");
  run("npx prisma generate");
  const types = psql(database, "SELECT count(*) FROM information_schema.columns WHERE table_name IN ('users','tickets','categories','locations') AND column_name='id' AND data_type='uuid';", true);
  if (types !== "4") throw new Error("Expected UUID primary keys in all four core tables; refusing to continue with a mismatched schema.");
  sqlFile("001_vector_and_indexes.sql");
  sqlFile("002_triggers_and_procedures.sql");
  sqlFile("003_views.sql");
  run("npm run seed");
  run("npm run smoke:test");
  console.log("\nSUCCESS: Fresh database, Prisma, pgvector, triggers, demo accounts and transaction smoke test are ready.");
  console.log("Run: npm run dev");
  console.log("Open: http://localhost:3100/login");
  console.log("Student: student1@campuscare.edu / " + demoPassword);
} catch (error) {
  console.error("\nSETUP FAILED:", error?.message ?? error);
  console.error("Your previous database was not deleted. Fix the error above and rerun npm run setup:fresh.");
  process.exitCode = 1;
}
