import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, HttpResponse, http } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "@/api/client";
import type { ApprovalKind } from "@/api/types";
import { db, taskById } from "@/mocks/db";
import { server } from "@/mocks/server";
import { renderApp } from "@/testUtils";

const idOf = (title: string) =>
	db.tasks.find((t) => t.title === title)?.id as number;

beforeEach(() => {
	localStorage.setItem("iris.userId", "1");
});

const STATUS = {
	"Needs Approval": "needs_approval",
	Done: "done",
	Ready: "ready",
	Backlog: "backlog",
} as const;

const column = (name: keyof typeof STATUS) =>
	within(
		document.querySelector(
			`section[data-status="${STATUS[name]}"]`,
		) as HTMLElement,
	);

async function requestFor(
	title: string,
	kind: ApprovalKind,
	approverUserId: number | null = null,
) {
	const { data } = await api.POST("/api/tasks/{id}/approvals", {
		params: { path: { id: idOf(title) } },
		body: {
			kind,
			summary: `Check ${title}`,
			payloadMd: "Result **body**",
			approverUserId,
		},
	});
	return data;
}

async function openDrawer(title: string) {
	renderApp(`/projects/1?task=${idOf(title)}`);
	await screen.findByTestId("pending-approval", {}, { timeout: 10_000 });
	await waitFor(
		() => expect(document.querySelector("section[data-status]")).not.toBeNull(),
		{ timeout: 10_000 },
	);
}

const TITLE = "Compare accommodation options";

describe("approval decisions in the drawer", () => {
	test.each([
		["sign_off", "Approve", "approved", "Done"],
		["proceed", "Approve", "approved", "Ready"],
		["sign_off", "Request changes", "changes_requested", "Ready"],
		["proceed", "Request changes", "changes_requested", "Ready"],
		["sign_off", "Reject", "rejected", "Backlog"],
		["proceed", "Reject", "rejected", "Backlog"],
	] as const)(
		"%s + %s moves the card to %s",
		async (kind, button, state, col) => {
			const user = userEvent.setup();
			await requestFor(TITLE, kind);
			await openDrawer(TITLE);
			const panel = within(screen.getByTestId("pending-approval"));
			expect(panel.getByText(`Check ${TITLE}`)).toBeInTheDocument();
			expect(
				panel.getByText(kind === "sign_off" ? "Sign-off" : "Proceed"),
			).toBeInTheDocument();
			expect(panel.getByText(/for any human/)).toBeInTheDocument();
			expect(column("Needs Approval").getByText(TITLE)).toBeInTheDocument();

			if (button !== "Approve") {
				expect(panel.getByRole("button", { name: button })).toBeDisabled();
				await user.type(panel.getByLabelText("Comment"), "Because reasons");
			}
			await user.click(panel.getByRole("button", { name: button }));

			await waitFor(() =>
				expect(column(col).getByText(TITLE)).toBeInTheDocument(),
			);
			expect(column("Needs Approval").queryByText(TITLE)).toBeNull();
			await waitFor(() =>
				expect(screen.queryByTestId("pending-approval")).toBeNull(),
			);
			const stored = db.approvals.find((a) => a.taskId === idOf(TITLE));
			expect(stored?.state).toBe(state);
			const history = screen.getByRole("list", { name: "Approval history" });
			expect(within(history).getByText(`Check ${TITLE}`)).toBeInTheDocument();
			if (button !== "Approve") {
				expect(
					within(history).getByText(/Because reasons/),
				).toBeInTheDocument();
			}
		},
	);

	test("the card moves before the server answers", async () => {
		server.use(
			http.post("/api/approvals/:id/decide", async () => {
				await delay(300);
				return undefined;
			}),
		);
		const user = userEvent.setup();
		await requestFor(TITLE, "sign_off");
		await openDrawer(TITLE);
		await user.click(screen.getByRole("button", { name: "Approve" }));
		expect(column("Done").getByText(TITLE)).toBeInTheDocument();
		expect(taskById(idOf(TITLE))?.status).toBe("needs_approval");
		await waitFor(() => expect(taskById(idOf(TITLE))?.status).toBe("done"));
	});

	test("a failed decision rolls the card back", async () => {
		server.use(
			http.post("/api/approvals/:id/decide", () =>
				HttpResponse.json({ message: "nope" }, { status: 500 }),
			),
		);
		const user = userEvent.setup();
		await requestFor(TITLE, "sign_off");
		await openDrawer(TITLE);
		await user.click(screen.getByRole("button", { name: "Approve" }));
		await waitFor(() =>
			expect(column("Needs Approval").getByText(TITLE)).toBeInTheDocument(),
		);
		expect(await screen.findByTestId("pending-approval")).toBeInTheDocument();
	});
});

describe("requesting approval", () => {
	test("human-to-human sign-off: A requests for B, B approves, task is done with the output", async () => {
		const user = userEvent.setup();
		const id = idOf(TITLE);
		const view = renderApp(`/projects/1?task=${id}`);
		await user.click(
			await screen.findByRole(
				"button",
				{ name: "Request approval" },
				{ timeout: 10_000 },
			),
		);
		await user.type(screen.getByLabelText("Summary"), "Guest list ready");
		await user.type(screen.getByLabelText("Details (Markdown)"), "Alice, Bob");
		await user.selectOptions(screen.getByLabelText("Approver"), "Partner");
		await user.selectOptions(screen.getByLabelText("Kind"), "sign_off");
		await user.click(screen.getByRole("button", { name: "Send for approval" }));

		await waitFor(() =>
			expect(column("Needs Approval").getByText(TITLE)).toBeInTheDocument(),
		);
		await waitFor(() => expect(db.approvals.at(-1)?.approverUserId).toBe(2));
		expect(db.approvals.at(-1)?.requestedBy).toMatchObject({ kind: "user" });
		const panel = await screen.findByTestId("pending-approval");
		expect(within(panel).getByText(/for Partner/)).toBeInTheDocument();

		// Switch the dev user to B and reload the drawer.
		view.unmount();
		localStorage.setItem("iris.userId", "2");
		renderApp(`/projects/1?task=${id}`);
		const bPanel = await screen.findByTestId(
			"pending-approval",
			{},
			{ timeout: 10_000 },
		);
		await user.click(within(bPanel).getByRole("button", { name: "Approve" }));
		await waitFor(() => expect(taskById(id)?.status).toBe("done"));
		expect(taskById(id)?.outputMd).toBe("Alice, Bob");
		expect(column("Done").getByText(TITLE)).toBeInTheDocument();
		expect(db.approvals.at(-1)?.decidedBy).toMatchObject({ kind: "user" });
	});

	test("the request form is hidden when pending or done, and prefilled from output", async () => {
		const user = userEvent.setup();
		const withOutput = taskById(idOf(TITLE));
		if (withOutput) withOutput.outputMd = "Existing output";
		renderApp(`/projects/1?task=${idOf(TITLE)}`);
		await user.click(
			await screen.findByRole(
				"button",
				{ name: "Request approval" },
				{ timeout: 10_000 },
			),
		);
		expect(screen.getByLabelText("Details (Markdown)")).toHaveValue(
			"Existing output",
		);
	});

	test("no request button on a done task", async () => {
		renderApp(`/projects/1?task=${idOf("Pick a destination")}`);
		await screen.findByText("No approvals yet", {}, { timeout: 10_000 });
		expect(
			screen.queryByRole("button", { name: "Request approval" }),
		).toBeNull();
	});
});
