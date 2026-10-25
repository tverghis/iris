import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";
import { Route, useSearch } from "wouter";
import type { BoardColumn } from "@/api/types";
import { db } from "@/mocks/db";
import { server } from "@/mocks/server";
import { Component as BoardPage } from "@/routes/BoardPage";
import { renderWithProviders } from "@/testUtils";

function Search() {
	return <output data-testid="search">{useSearch()}</output>;
}

function renderBoard(route = "/projects/1") {
	return renderWithProviders(
		<>
			<Route path="/projects/:projectId" component={BoardPage} />
			<Search />
		</>,
		route,
	);
}

const column = (name: string) => screen.getByRole("region", { name });
const titles = (name: string) =>
	within(column(name))
		.queryAllByRole("button", { name: /^(?!Show more)/ })
		.map((b) => b.querySelector("span")?.textContent);

describe("board", () => {
	test("renders the six columns matching the API", async () => {
		renderBoard();
		expect(
			await screen.findByRole("heading", { name: "Summer trip" }),
		).toBeInTheDocument();
		const names = [...document.querySelectorAll("[data-status]")].map((r) =>
			r.getAttribute("data-status"),
		);
		expect(names).toEqual([
			"backlog",
			"ready",
			"in_progress",
			"needs_approval",
			"blocked",
			"done",
		]);
		expect(titles("Backlog")).toEqual([
			"Draft packing list",
			"Travel insurance quotes",
			"Rent a car",
		]);
		expect(titles("In Progress")).toEqual([
			"Research rail passes",
			"Book the flights",
		]);
		expect(titles("Blocked")).toEqual(["Which airport do you prefer?"]);
		expect(
			screen.getByRole("link", { name: "Project context" }),
		).toHaveAttribute("href", "/projects/1/context");
	});

	test("cards show assignee, waiting, approval and running indicators", async () => {
		renderBoard();
		await screen.findByRole("heading", { name: "Summer trip" });
		const rent = screen.getByRole("button", { name: /Rent a car/ });
		expect(within(rent).getByText("Waiting on 1")).toBeInTheDocument();
		expect(
			await within(rent).findByLabelText("Assigned to Partner"),
		).toHaveTextContent("P");
		const shortlist = screen.getByRole("button", {
			name: /Shortlist coastal towns/,
		});
		expect(within(shortlist).getByText("Approval")).toBeInTheDocument();
		expect(
			within(shortlist).getByLabelText("Assigned to agent"),
		).toBeInTheDocument();
		const rail = screen.getByRole("button", { name: /Research rail passes/ });
		expect(within(rail).getByText("Running")).toBeInTheDocument();
		const packing = screen.getByRole("button", { name: /Draft packing list/ });
		expect(within(packing).queryByText(/Waiting on/)).toBeNull();
	});

	test("quick add creates a card without refetching the board", async () => {
		let boardFetches = 0;
		server.use(
			http.get("/api/projects/:id/board", () => {
				boardFetches++;
				return undefined;
			}),
		);
		const user = userEvent.setup();
		renderBoard();
		await screen.findByRole("heading", { name: "Summer trip" });
		const input = screen.getByLabelText("Add task to Ready");
		await user.type(input, "Buy sunscreen{Enter}");
		expect(
			await within(column("Ready")).findByRole("button", {
				name: /Buy sunscreen/,
			}),
		).toBeInTheDocument();
		expect(input).toHaveValue("");
		expect(boardFetches).toBe(1);
		expect(
			db.tasks.some((t) => t.title === "Buy sunscreen" && t.status === "ready"),
		).toBe(true);
	});

	test("quick add is only offered in Backlog and Ready", async () => {
		renderBoard();
		await screen.findByRole("heading", { name: "Summer trip" });
		expect(screen.getAllByRole("textbox")).toHaveLength(2);
	});

	test("filters by mine, agent and all, and keep state in the URL", async () => {
		localStorage.setItem("iris.userId", "1");
		const user = userEvent.setup();
		renderBoard();
		await screen.findByRole("heading", { name: "Summer trip" });

		await user.click(screen.getByRole("button", { name: "Mine" }));
		expect(screen.getByTestId("search")).toHaveTextContent("filter=mine");
		expect(titles("In Progress")).toEqual(["Book the flights"]);
		expect(titles("Backlog")).toEqual([]);

		await user.click(screen.getByRole("button", { name: "Agent" }));
		expect(titles("Backlog")).toEqual(["Travel insurance quotes"]);
		expect(titles("In Progress")).toEqual(["Research rail passes"]);

		await user.click(screen.getByRole("button", { name: "All" }));
		expect(screen.getByTestId("search")).not.toHaveTextContent("filter");
		expect(titles("Backlog")).toHaveLength(3);
	});

	test("filter is restored from the URL", async () => {
		localStorage.setItem("iris.userId", "2");
		renderBoard("/projects/1?filter=mine");
		await screen.findByRole("heading", { name: "Summer trip" });
		expect(screen.getByRole("button", { name: "Mine" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(titles("Backlog")).toEqual(["Rent a car"]);
	});

	test("clicking a card sets ?task=<id>", async () => {
		const user = userEvent.setup();
		renderBoard("/projects/1?filter=agent");
		await screen.findByRole("heading", { name: "Summer trip" });
		await user.click(
			screen.getByRole("button", { name: /Research rail passes/ }),
		);
		const id = db.tasks.find((t) => t.title === "Research rail passes")?.id;
		const search = screen.getByTestId("search");
		expect(search).toHaveTextContent(`task=${id}`);
		expect(search).toHaveTextContent("filter=agent");
	});

	test("Done shows the latest 20 with Show more", async () => {
		const done = Array.from({ length: 45 }, (_, i) => ({
			id: 100 + i,
			projectId: 1,
			title: `Done ${i}`,
			status: "done" as const,
			position: i,
			assigneeKind: "none" as const,
			assigneeUserId: null,
			waitingOn: 0,
			pendingApproval: null,
			running: false,
			requireSignOff: false,
			doneAt: new Date(2026, 0, 1, 0, i).toISOString(),
			updatedAt: new Date(2026, 0, 1).toISOString(),
		}));
		server.use(
			http.get("/api/projects/:id/board", () =>
				HttpResponse.json({
					project: {
						id: 1,
						name: "Big",
						briefMd: "",
						archivedAt: null,
						createdAt: "2026-01-01T00:00:00Z",
						updatedAt: "2026-01-01T00:00:00Z",
						needsApprovalCount: 0,
						blockedCount: 0,
						agentRunning: false,
					},
					columns: (
						[
							"backlog",
							"ready",
							"in_progress",
							"needs_approval",
							"blocked",
							"done",
						] as const
					).map(
						(status): BoardColumn => ({
							status,
							tasks: status === "done" ? done : [],
						}),
					),
				}),
			),
		);
		const user = userEvent.setup();
		renderBoard();
		await screen.findByRole("heading", { name: "Big" });
		expect(titles("Done")).toHaveLength(20);
		expect(titles("Done")[0]).toBe("Done 44");
		expect(titles("Done")[19]).toBe("Done 25");

		await user.click(screen.getByRole("button", { name: "Show more" }));
		expect(titles("Done")).toHaveLength(40);
		await user.click(screen.getByRole("button", { name: "Show more" }));
		expect(titles("Done")).toHaveLength(45);
		expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
	});

	test("shows a not found state for an unknown project", async () => {
		renderBoard("/projects/999");
		expect(
			await screen.findByRole("heading", { name: "Project not found" }),
		).toBeInTheDocument();
	});

	test("shows an error state with retry", async () => {
		server.use(
			http.get(
				"/api/projects/:id/board",
				() => new HttpResponse("boom", { status: 500 }),
			),
		);
		const user = userEvent.setup();
		renderBoard();
		await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument(), {
			timeout: 3000,
		});
		server.resetHandlers();
		await user.click(screen.getByRole("button", { name: "Retry" }));
		expect(
			await screen.findByRole("heading", { name: "Summer trip" }),
		).toBeInTheDocument();
	});
});
