// Manual full backup of the database (every table in the Prisma schema) to a
// JSON file outside the repo. Use it before and after big changes, and
// regularly until you move to a plan with automatic backups.
//
// The file contains customer emails, addresses and orders. It is written
// with owner-only permissions into ~/grv-backups and must never be
// committed, emailed or shared.
//
//   pnpm db:backup                       # writes ~/grv-backups/grv-backup-<time>.json
//   pnpm db:backup --dir=/some/folder    # somewhere else (e.g. an encrypted drive)
//
// Restore with scripts/restoreDatabase.js. Not included: Supabase login
// accounts (passwords live in Supabase Auth, not in this database), and
// images/videos (those live in Cloudinary).
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dirArg = process.argv.find((arg) => arg.startsWith("--dir="));
const dir = dirArg ? dirArg.split("=")[1] : join(homedir(), "grv-backups");

const accessor = (modelName) => modelName.charAt(0).toLowerCase() + modelName.slice(1);

const main = async () => {
  const models = Prisma.dmmf.datamodel.models.map((model) => model.name);
  const tables = {};
  const counts = {};

  for (const name of models) {
    tables[name] = await prisma[accessor(name)].findMany();
    counts[name] = tables[name].length;
  }

  // Verify against the database again so a write landing mid-backup, or a
  // silently truncated read, is noticed rather than trusted.
  const drift = [];
  for (const name of models) {
    const now = await prisma[accessor(name)].count();
    if (now !== counts[name]) drift.push(`${name}: read ${counts[name]}, now ${now}`);
  }

  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(dir, `grv-backup-${stamp}.json`);
  writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), counts, tables }), { mode: 0o600 });

  const rows = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const nonEmpty = Object.entries(counts).filter(([, n]) => n > 0);
  console.log(`Backup written: ${file}`);
  console.log(`  ${rows} rows across ${nonEmpty.length} tables, ${(statSync(file).size / 1024).toFixed(0)} KB`);
  for (const [name, n] of nonEmpty) console.log(`  ${String(n).padStart(6)}  ${name}`);
  if (drift.length) {
    console.log("\nData changed while the backup was running — run it again for a consistent copy:");
    for (const line of drift) console.log(`  ${line}`);
    process.exitCode = 2;
  }
};

main()
  .catch((error) => {
    console.error("Backup failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
