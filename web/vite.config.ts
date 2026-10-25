import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
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

// Starts the board request while the JS downloads; the board query consumes it.
// Production builds only, so it never races the MSW worker in dev or mock mode.
const BOARD_PREFETCH = `(function(){var m=/^\\/projects\\/(\\d+)\\/?$/.exec(location.pathname);if(!m)return;var h={};try{var u=localStorage.getItem("iris.userId");if(u)h["X-Iris-User"]=u}catch(e){}var id=+m[1];var p=fetch("/api/projects/"+id+"/board",{headers:h});p.catch(function(){});window.__irisBoardPrefetch={projectId:id,startedAt:Date.now(),promise:p}})();`;

function boardPrefetch(): Plugin {
	return {
		name: "iris-board-prefetch",
		apply: "build",
		transformIndexHtml() {
			if (process.env.VITE_MOCK_API === "true") return;
			return [
				{ tag: "script", children: BOARD_PREFETCH, injectTo: "head-prepend" },
			];
		},
	};
}

export default defineConfig({
	define: {
		__APP_BUILD__: JSON.stringify(
			process.env.IRIS_BUILD_ID ?? Date.now().toString(36),
		),
	},
	plugins: [
		react(),
		babel({ presets: [reactCompilerPreset()] }),
		tailwindcss(),
		mockServiceWorker(),
		boardPrefetch(),
		VitePWA({
			registerType: "autoUpdate",
			injectRegister: false,
			manifest: {
				name: "Iris",
				short_name: "Iris",
				description: "Task board for humans and agents",
				display: "standalone",
				start_url: "/",
				scope: "/",
				theme_color: "#ffffff",
				background_color: "#ffffff",
				icons: [
					{ src: "icon-192.png", sizes: "192x192", type: "image/png" },
					{ src: "icon-512.png", sizes: "512x512", type: "image/png" },
					{
						src: "icon-maskable-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,png,webmanifest}"],
				navigateFallback: "index.html",
				navigateFallbackDenylist: [
					/^\/api(\/|$)/,
					/^\/mcp(\/|$)/,
					/^\/healthz$/,
				],
				cleanupOutdatedCaches: true,
				clientsClaim: true,
				skipWaiting: true,
			},
		}),
	],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	build: { manifest: true },
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
		testTimeout: 30_000,
	},
});
