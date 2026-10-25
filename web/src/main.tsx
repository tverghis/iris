import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

async function enableMocking() {
	if (import.meta.env.VITE_MOCK_API !== "true") return;
	const { worker } = await import("./mocks/browser");
	await worker.start({ onUnhandledFrame: "bypass" });
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
