// Pure helpers for the bundle budget gate (see check-size.mjs).

export const BOARD_ENTRY = "src/routes/BoardPage.tsx";

// Manifest keys reachable from the roots through static `imports`, transitively.
// Dynamic imports are excluded: they are not part of the first load.
export function collectChunks(manifest, roots) {
	const seen = new Set();
	const visit = (key) => {
		if (seen.has(key)) return;
		const chunk = manifest[key];
		if (!chunk) throw new Error(`manifest has no chunk "${key}"`);
		seen.add(key);
		for (const dep of chunk.imports ?? []) visit(dep);
	};
	for (const root of roots) visit(root);
	return [...seen];
}

// Roots are the HTML entry and the board route chunk. `sizeOf(file)` returns the
// gzipped size in bytes of a chunk file.
export function boardBudget(manifest, sizeOf, boardKey = BOARD_ENTRY) {
	const entry = Object.keys(manifest).find((k) => manifest[k].isEntry);
	if (!entry || !manifest[boardKey]) {
		throw new Error(`manifest is missing the entry or ${boardKey}`);
	}
	const rows = collectChunks(manifest, [entry, boardKey]).map((key) => ({
		key,
		file: manifest[key].file,
		gzip: sizeOf(manifest[key].file),
	}));
	return { rows, total: rows.reduce((n, r) => n + r.gzip, 0) };
}
