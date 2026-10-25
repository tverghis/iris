import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

// The MSW worker script lives outside public/ so it never reaches dist/.
function mockServiceWorker(): Plugin {
	return {
		name: "iris-mock-service-worker",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use("/mockServiceWorker.js", (_req, res) => {
				res.setHeader("Content-Type", "text/javascript");
				res.end(
					readFileSync(
						fileURLToPath(
							new URL("./dev-public/mockServiceWorker.js", import.meta.url),
						),
					),
				);
			});
		},
	};
}

export default defineConfig({
	plugins: [react(), tailwindcss(), mockServiceWorker()],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	server: {
		proxy: {
			"/api": "http://localhost:8080",
			"/mcp": "http://localhost:8080",
			"/healthz": "http://localhost:8080",
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: "./src/setupTests.ts",
	},
});
