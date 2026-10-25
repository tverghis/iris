import { useState } from "react";

type HealthStatus = "idle" | "checking" | "healthy" | "unavailable";

function App() {
	const [healthStatus, setHealthStatus] = useState<HealthStatus>("idle");

	async function checkHealth() {
		setHealthStatus("checking");

		try {
			const response = await fetch("/healthz");
			setHealthStatus(response.ok ? "healthy" : "unavailable");
		} catch {
			setHealthStatus("unavailable");
		}
	}

	return (
		<main>
			<h1>Welcome, Iris.</h1>
			<button
				type="button"
				onClick={checkHealth}
				disabled={healthStatus === "checking"}
			>
				Check health
			</button>
			<p role="status">
				{healthStatus === "checking" && "Checking…"}
				{healthStatus === "healthy" && "Healthy"}
				{healthStatus === "unavailable" && "Unavailable"}
			</p>
		</main>
	);
}

export default App;
