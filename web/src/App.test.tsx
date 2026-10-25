import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import App from "./App";

test("displays the welcome message", () => {
	render(<App />);

	expect(
		screen.getByRole("heading", { name: "Welcome, Iris." }),
	).toBeInTheDocument();
});

test("checks the proxied health endpoint", async () => {
	const fetchMock = vi
		.fn()
		.mockResolvedValue(new Response(null, { status: 200 }));
	vi.stubGlobal("fetch", fetchMock);
	render(<App />);

	const button = screen.getByRole("button", { name: "Check health" });
	fireEvent.click(button);

	expect(button).toBeDisabled();
	expect(await screen.findByText("Healthy")).toBeInTheDocument();
	expect(button).toBeEnabled();
	expect(fetchMock).toHaveBeenCalledWith("/healthz");
});

test("reports an unhealthy backend response", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
	);
	render(<App />);

	fireEvent.click(screen.getByRole("button", { name: "Check health" }));

	expect(await screen.findByText("Unavailable")).toBeInTheDocument();
});
