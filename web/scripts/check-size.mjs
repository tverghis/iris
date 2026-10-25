// Fails when the JS needed for the board route's first load exceeds the budget.
// Run after `npm run build`; reads dist/.vite/manifest.json.
// Override the budget with SIZE_BUDGET_KB (1 kB = 1000 bytes).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { boardBudget } from "./sizeBudget.mjs";

const budgetKb = Number(process.env.SIZE_BUDGET_KB ?? 150);
if (!Number.isFinite(budgetKb) || budgetKb <= 0) {
	console.error(`Invalid SIZE_BUDGET_KB: ${process.env.SIZE_BUDGET_KB}`);
	process.exit(1);
}
const budget = budgetKb * 1000;
const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const kb = (n) => `${(n / 1000).toFixed(1)} kB`;

let result;
try {
	const manifest = JSON.parse(readFileSync(join(dist, ".vite/manifest.json")));
	result = boardBudget(
		manifest,
		(file) => gzipSync(readFileSync(join(dist, file))).length,
	);
} catch (err) {
	console.error(`${err.message}; run npm run build first`);
	process.exit(1);
}

console.log("Board route first-load JS (gzipped)");
for (const r of result.rows) {
	console.log(`  ${r.file.padEnd(44)} ${kb(r.gzip).padStart(10)}`);
}
console.log(
	`  ${"total".padEnd(44)} ${kb(result.total).padStart(10)} (budget ${kb(budget)})`,
);

if (result.total > budget) {
	console.error("Over budget.");
	process.exit(1);
}
