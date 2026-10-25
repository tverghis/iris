// Fails when the JS needed for the board route's first load exceeds the budget.
// Run after `npm run build`; reads dist/.vite/manifest.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET = 150 * 1000;
const BOARD = "src/routes/BoardPage.tsx";
const dist = new URL("../dist/", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(dist, ".vite/manifest.json")));

const entry = Object.keys(manifest).find((k) => manifest[k].isEntry);
if (!entry || !manifest[BOARD]) {
	console.error(`manifest is missing the entry or ${BOARD}; run npm run build`);
	process.exit(1);
}

const seen = new Set();
function collect(key) {
	if (seen.has(key)) return;
	seen.add(key);
	for (const dep of manifest[key].imports ?? []) collect(dep);
}
collect(entry);
collect(BOARD);

const rows = [...seen].map((key) => {
	const file = manifest[key].file;
	const raw = readFileSync(join(dist, file));
	return { file, raw: raw.length, gzip: gzipSync(raw).length };
});
const total = rows.reduce((n, r) => n + r.gzip, 0);
const kb = (n) => `${(n / 1000).toFixed(1)} kB`;

console.log("Board route first-load JS");
for (const r of rows) {
	console.log(
		`  ${r.file.padEnd(44)} ${kb(r.raw).padStart(10)} ${kb(r.gzip).padStart(10)} gz`,
	);
}
console.log(
	`  ${"total".padEnd(44)} ${"".padStart(10)} ${kb(total).padStart(10)} gz (budget ${kb(BUDGET)})`,
);

if (total > BUDGET) {
	console.error("Over budget.");
	process.exit(1);
}
