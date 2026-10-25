import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { expect, test } from "vitest";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Board } from "@/api/types";
import { db, taskById } from "@/mocks/db";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/testUtils";
import { type MoveVars, useBoard, useMoveTask } from "./useBoard";

function Harness({ vars }: { vars: MoveVars }) {
	const { columns } = useBoard(1);
	const { move } = useMoveTask(1);
	return (
		<>
			<button type="button" onClick={() => move(vars)}>
				move
			</button>
			{columns?.map((c) => (
				<output key={c.status} data-testid={c.status}>
					{c.tasks.map((t) => t.title).join("|")}
				</output>
			))}
		</>
	);
}

const idOf = (title: string) =>
	db.tasks.find((t) => t.title === title)?.id ?? 0;
const text = (status: string) => screen.getByTestId(status).textContent;

test("a move updates the board at once, without refetching, and persists", async () => {
	let boardFetches = 0;
	server.use(
		http.get("/api/projects/:id/board", () => {
			boardFetches++;
			return undefined;
		}),
	);
	const user = userEvent.setup();
	renderWithProviders(
		<Harness
			vars={{
				taskId: idOf("Rent a car"),
				status: "ready",
				afterTaskId: null,
			}}
		/>,
	);
	await waitFor(() => expect(text("backlog")).toContain("Rent a car"));
	await user.click(screen.getByRole("button", { name: "move" }));
	expect(text("ready")).toMatch(/^Rent a car\|/);
	expect(text("backlog")).not.toContain("Rent a car");

	await waitFor(() =>
		expect(taskById(idOf("Rent a car"))?.status).toBe("ready"),
	);
	expect(text("ready")).toMatch(/^Rent a car\|/);
	expect(boardFetches).toBe(1);

	const fresh = await api.GET("/api/projects/{id}/board", {
		params: { path: { id: 1 } },
	});
	const ready = (fresh.data as Board).columns.find((c) => c.status === "ready");
	expect(ready?.tasks[0].title).toBe("Rent a car");
});

test("a rejected move rolls back and shows the server's reason once", async () => {
	const reason = "Only the dispatcher can move an agent task into In Progress";
	let reject = () => {};
	const gate = new Promise<void>((resolve) => {
		reject = resolve;
	});
	server.use(
		http.post("/api/tasks/:id/move", async () => {
			await gate;
			return HttpResponse.json({ message: reason }, { status: 409 });
		}),
	);
	const user = userEvent.setup();
	renderWithProviders(
		<Harness
			vars={{
				taskId: idOf("Travel insurance quotes"),
				status: "in_progress",
				afterTaskId: null,
			}}
		/>,
	);
	await waitFor(() => expect(text("backlog")).toContain("Travel insurance"));
	const before = text("in_progress");
	await user.click(screen.getByRole("button", { name: "move" }));
	expect(text("in_progress")).toMatch(/^Travel insurance quotes\|/);
	reject();
	expect(await screen.findByText(reason)).toBeInTheDocument();
	await waitFor(() => expect(text("in_progress")).toBe(before));
	expect(text("backlog")).toContain("Travel insurance quotes");
	expect(screen.getAllByText(reason)).toHaveLength(1);
	expect(taskById(idOf("Travel insurance quotes"))?.status).toBe("backlog");
});

function TwoMoves({ a, b }: { a: MoveVars; b: MoveVars }) {
	const { columns } = useBoard(1);
	const { move } = useMoveTask(1);
	return (
		<>
			<button type="button" onClick={() => move(a)}>
				move A
			</button>
			<button type="button" onClick={() => move(b)}>
				move B
			</button>
			{columns?.map((c) => (
				<output key={c.status} data-testid={c.status}>
					{c.tasks.map((t) => t.title).join("|")}
				</output>
			))}
		</>
	);
}

test("a rejected move only puts back its own card, not a snapshot over a later move", async () => {
	const reason = "Nope";
	const b = idOf("Travel insurance quotes");
	let release = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	server.use(
		http.post("/api/tasks/:id/move", async ({ params }) => {
			if (Number(params.id) !== b) return undefined;
			await gate;
			return HttpResponse.json({ message: reason }, { status: 409 });
		}),
	);
	const user = userEvent.setup();
	renderWithProviders(
		<TwoMoves
			a={{ taskId: idOf("Rent a car"), status: "ready", afterTaskId: null }}
			b={{ taskId: b, status: "in_progress", afterTaskId: null }}
		/>,
	);
	await waitFor(() => expect(text("backlog")).toContain("Rent a car"));
	await user.click(screen.getByRole("button", { name: "move B" }));
	await user.click(screen.getByRole("button", { name: "move A" }));
	await waitFor(() =>
		expect(taskById(idOf("Rent a car"))?.status).toBe("ready"),
	);

	release();
	expect(await screen.findByText(reason)).toBeInTheDocument();
	expect(text("ready")).toMatch(/^Rent a car\|/);
	expect(text("backlog")).toContain("Travel insurance quotes");
	expect(text("in_progress")).not.toContain("Travel insurance quotes");
});

test("a settled move marks the projects list (its counts) stale", async () => {
	const user = userEvent.setup();
	const { queryClient } = renderWithProviders(
		<Harness
			vars={{
				taskId: idOf("Rent a car"),
				status: "ready",
				afterTaskId: null,
			}}
		/>,
	);
	await waitFor(() => expect(text("backlog")).toContain("Rent a car"));
	queryClient.setQueryData(queryKeys.projects.list(), []);
	await user.click(screen.getByRole("button", { name: "move" }));
	await waitFor(() =>
		expect(
			queryClient.getQueryState(queryKeys.projects.list())?.isInvalidated,
		).toBe(true),
	);
});
