import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

async function enableMocking() {
	if (import.meta.env.VITE_MOCK_API !== "true") return;
	const { worker } = await import("./mocks/browser");
	await worker.start({ onUnhandledFrame: "bypass" });
}

// Production only: dev and mock mode must not have a caching service worker.
if (
	import.meta.env.PROD &&
	import.meta.env.VITE_MOCK_API !== "true" &&
	"serviceWorker" in navigator
) {
	void import("virtual:pwa-register").then(({ registerSW }) =>
		registerSW({ immediate: true }),
	);
}

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Root element not found");
}

enableMocking().then(() => {
	createRoot(rootElement).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
});
