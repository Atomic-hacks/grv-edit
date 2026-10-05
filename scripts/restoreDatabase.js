// Restores a backup made by scripts/backupDatabase.js.
//
// SAFE BY DEFAULT: it only fills EMPTY tables and refuses to touch a table
// that already has rows, so it can't overwrite live data. Without --apply it
// only reports what it would do.
//
//   node scripts/restoreDatabase.js <backup.json>            # dry run
//   node scripts/restoreDatabase.js <backup.json> --apply    # restore into empty tables
//
// To restore over existing data you must empty those tables yourself first,
// deliberately. Everything runs in one transaction: on any error nothing is
// restored. Run `pnpm db:lock` afterwards if you restored into a fresh project.
import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const file = process.argv.find((arg, i) => i > 1 && !arg.startsWith("--"));
const apply = process.argv.includes("--apply");

const accessor = (name) => name.charAt(0).toLowerCase() + name.slice(1);
const models = Prisma.dmmf.datamodel.models;

// Parents before children, so foreign keys are satisfied as rows go in.
export const insertionOrder = (modelList) => {
  const names = new Set(modelList.map((model) => model.name));
  const dependsOn = new Map(
    modelList.map((model) => [
      model.name,
      new Set(
        model.fields
          .filter((f) => f.relationFromFields?.length && f.type !== model.name && names.has(f.type))
          .map((f) => f.type),
      ),
    ]),
  );
  const ordered = [];
  const remaining = new Set(names);
  while (remaining.size) {
    const ready = [...remaining].filter((name) => [...dependsOn.get(name)].every((dep) => !remaining.has(dep)));
    if (!ready.length) throw new Error(`Circular table dependency among: ${[...remaining].join(", ")}`);
    for (const name of ready) {
      ordered.push(name);
      remaining.delete(name);
    }
  }
  return ordered;
};

// JSON turns dates into strings; turn the DateTime columns back.
const revive = (model, row) => {
  const out = { ...row };
  for (const field of model.fields) {
    if (field.type === "DateTime" && out[field.name] != null) out[field.name] = new Date(out[field.name]);
  }
  return out;
};

// Rows that reference their own table (Category.parentId) go in parent-first.
const selfParentField = (model) =>
  model.fields.find((f) => f.type === model.name && f.relationFromFields?.length)?.relationFromFields[0];
const parentFirst = (rows, parentKey) => {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const depth = (row, seen = new Set()) =>
    !row[parentKey] || !byId.has(row[parentKey]) || seen.has(row.id)
      ? 0
      : 1 + depth(byId.get(row[parentKey]), seen.add(row.id));
  return [...rows].sort((a, b) => depth(a) - depth(b));
};

const main = async () => {
  if (!file) throw new Error("Usage: node scripts/restoreDatabase.js <backup.json> [--apply]");
  const backup = JSON.parse(readFileSync(file, "utf8"));
  const byName = new Map(models.map((model) => [model.name, model]));
  const order = insertionOrder(models);

  console.log(`${apply ? "RESTORING" : "DRY RUN"} from ${file} (taken ${backup.takenAt})\n`);
  const plan = [];
  for (const name of order) {
    const rows = backup.tables[name] || [];
    if (!rows.length) continue;
    const existing = await prisma[accessor(name)].count();
    if (existing > 0) {
      throw new Error(`${name} already has ${existing} rows — refusing to overwrite. Empty it first if you really mean to.`);
    }
    plan.push([name, rows]);
    console.log(`  restore ${String(rows.length).padStart(6)}  ${name}`);
  }
  if (!apply) return console.log("\nNothing changed. Re-run with --apply to restore.");

  await prisma.$transaction(
    async (tx) => {
      for (const [name, rows] of plan) {
        const model = byName.get(name);
        const parentKey = selfParentField(model);
        const ready = (parentKey ? parentFirst(rows, parentKey) : rows).map((row) => revive(model, row));
        if (parentKey) {
          for (const row of ready) await tx[accessor(name)].create({ data: row });
        } else {
          await tx[accessor(name)].createMany({ data: ready });
        }
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
  console.log("\nRestore complete.");
};

// Only run when executed directly, so the ordering helper can be tested.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error) => {
      console.error("Restore failed — nothing was restored:", error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
