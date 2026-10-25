import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { expect, test, vi } from "vitest";
import { DispatcherStatus } from "@/components/DispatcherStatus";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/testUtils";

const idleIn = (ms: number) => ({
	currentRun: null,
	nextTickAt: new Date(Date.now() + ms).toISOString(),
});

test("idle state shows the next tick and enables Run now", async () => {
	server.use(
		http.get("/api/dispatch/status", () =>
			HttpResponse.json(idleIn(5 * 60_000 + 5000)),
		),
	);
	renderWithProviders(<DispatcherStatus />);
	expect(await screen.findByText("Next tick in 6m")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Run now" })).toBeEnabled();
});

test("running state links the task and disables Run now", async () => {
	server.use(
		http.get("/api/dispatch/status", () =>
			HttpResponse.json({
				currentRun: {
					runId: 7,
					taskId: 42,
					taskTitle: "Write the docs",
					projectId: 3,
					startedAt: new Date(Date.now() - 5 * 60_000 - 1000).toISOString(),
				},
				nextTickAt: null,
			}),
		),
	);
	renderWithProviders(<DispatcherStatus />);
	const link = await screen.findByRole("link", { name: "Write the docs" });
	expect(link).toHaveAttribute("href", "/projects/3?task=42");
	expect(screen.getByText("5m")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Run now" })).toBeDisabled();
});

test("a status failure shows unknown without a toast", async () => {
	server.use(
		http.get("/api/dispatch/status", () =>
			HttpResponse.json({ message: "boom" }, { status: 400 }),
		),
	);
	renderWithProviders(<DispatcherStatus />);
	expect(await screen.findByText("Dispatcher: unknown")).toBeInTheDocument();
	expect(screen.queryByText("boom")).not.toBeInTheDocument();
});

test("Run now posts, confirms and refetches status", async () => {
	const post = vi.fn();
	let gets = 0;
	server.use(
		http.get("/api/dispatch/status", () => {
			gets++;
			return HttpResponse.json(idleIn(600_000));
		}),
		http.post("/api/dispatch/run-now", () => {
			post();
			return HttpResponse.json(idleIn(600_000));
		}),
	);
	renderWithProviders(<DispatcherStatus />);
	const button = await screen.findByRole("button", { name: "Run now" });
	await waitFor(() => expect(button).toBeEnabled());
	await userEvent.click(button);
	expect(await screen.findByText("Tick requested")).toBeInTheDocument();
	expect(post).toHaveBeenCalledTimes(1);
	await waitFor(() => expect(gets).toBeGreaterThan(1));
});
