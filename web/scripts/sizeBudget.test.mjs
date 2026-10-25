import { describe, expect, it } from "vitest";
import { boardBudget, collectChunks } from "./sizeBudget.mjs";

const manifest = {
	"index.html": {
		file: "assets/index.js",
		isEntry: true,
		imports: ["_react.js"],
		dynamicImports: ["src/routes/BoardPage.tsx", "src/routes/Other.tsx"],
	},
	"_react.js": { file: "assets/react.js" },
	"src/routes/BoardPage.tsx": {
		file: "assets/BoardPage.js",
		imports: ["index.html", "_a.js"],
	},
	"_a.js": { file: "assets/a.js", imports: ["_b.js"] },
	"_b.js": { file: "assets/b.js", imports: ["_a.js"] },
	"src/routes/Other.tsx": { file: "assets/Other.js", imports: ["_react.js"] },
};
const sizes = {
	"assets/index.js": 100,
	"assets/react.js": 10,
	"assets/BoardPage.js": 20,
	"assets/a.js": 3,
	"assets/b.js": 4,
	"assets/Other.js": 999,
};

describe("bundle budget", () => {
	it("follows static imports transitively, once, tolerating cycles", () => {
		const keys = collectChunks(manifest, [
			"index.html",
			"src/routes/BoardPage.tsx",
		]);
		expect(keys.sort()).toEqual(
			[
				"_a.js",
				"_b.js",
				"_react.js",
				"index.html",
				"src/routes/BoardPage.tsx",
			].sort(),
		);
	});

	it("sums gzip sizes and ignores other lazy routes", () => {
		expect(boardBudget(manifest, (f) => sizes[f]).total).toBe(137);
	});

	it("throws when the board chunk is missing", () => {
		const { "src/routes/BoardPage.tsx": _, ...rest } = manifest;
		expect(() => boardBudget(rest, (f) => sizes[f])).toThrow(/missing/);
	});

	it("throws when there is no entry", () => {
		const m = { ...manifest, "index.html": { file: "x.js" } };
		expect(() => boardBudget(m, (f) => sizes[f] ?? 0)).toThrow(/missing/);
	});

	it("throws on a dangling import", () => {
		const m = {
			...manifest,
			"_a.js": { file: "assets/a.js", imports: ["nope"] },
		};
		expect(() => boardBudget(m, (f) => sizes[f] ?? 0)).toThrow(/nope/);
	});
});
