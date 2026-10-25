// Lighthouse (mobile preset) against the built app.
//
//   npm run build && npm run lighthouse
//   npm run lighthouse -- --assert                  fail if performance < 90
//   npm run lighthouse -- --url https://iris.example --path / --path /projects/1
//
// Without --url it serves dist/ with `vite preview`. Preview has no backend, so
// data screens show errors: the number reflects the app shell only.
// Chromium comes from Playwright (already installed); override with CHROME_PATH.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const THRESHOLD = 90;
const { values } = parseArgs({
	options: {
		url: { type: "string" },
		path: { type: "string", multiple: true },
		assert: { type: "boolean", default: false },
		port: { type: "string", default: "4173" },
	},
});
const paths = values.path?.length ? values.path : ["/", "/projects/1"];
const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);

function chromiumPath() {
	if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
	try {
		return require("playwright").chromium.executablePath();
	} catch {
		const { execSync } = require("node:child_process");
		const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
		return require(`${globalRoot}/playwright`).chromium.executablePath();
	}
}

async function startPreview(port) {
	const { preview } = await import("vite");
	const server = await preview({
		root,
		logLevel: "silent",
		preview: { port, strictPort: true, host: "127.0.0.1" },
	});
	return {
		base: `http://127.0.0.1:${port}`,
		stop: () => server.close(),
	};
}

const previewServer = values.url
	? null
	: await startPreview(Number(values.port));
const base = values.url ?? previewServer.base;

const { default: lighthouse } = await import("lighthouse");
const { launch } = await import("chrome-launcher");
const chrome = await launch({
	chromePath: chromiumPath(),
	chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});

let failed = false;
try {
	for (const path of paths) {
		const url = new URL(path, base).href;
		const result = await lighthouse(url, {
			port: chrome.port,
			output: "json",
			logLevel: "error",
			onlyCategories: ["performance"],
		});
		const lhr = result.lhr;
		const score = Math.round((lhr.categories.performance.score ?? 0) * 100);
		const a = lhr.audits;
		console.log(`\n${url}  performance ${score}`);
		for (const id of [
			"first-contentful-paint",
			"largest-contentful-paint",
			"total-blocking-time",
			"cumulative-layout-shift",
			"speed-index",
			"interactive",
		]) {
			console.log(`  ${a[id].title.padEnd(28)} ${a[id].displayValue}`);
		}
		if (score < THRESHOLD) failed = true;
	}
} finally {
	await chrome.kill();
	previewServer?.stop();
}

if (failed && values.assert) {
	console.error(`Performance below ${THRESHOLD}.`);
	process.exit(1);
}
process.exit(0);
