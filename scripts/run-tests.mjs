// Lance chaque test de « test:source » l'un après l'autre, sans s'arrêter au premier échec,
// puis affiche le bilan. Utilisé par « npm run test:postgres » (HARNESS_PG=1).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const files = [...pkg.scripts["test:source"].matchAll(/node (tests\/[\w.-]+\.mjs)/g)].map((m) => m[1]);
const failed = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [f], { stdio: "inherit", env: process.env });
  if (r.status !== 0) failed.push(f);
}
console.log(`\n${files.length - failed.length}/${files.length} tests réussis.`);
if (failed.length) {
  console.log("Échecs :\n  " + failed.join("\n  "));
  process.exit(1);
}
