import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "@/api/client";
import { db } from "@/mocks/db";
import { server } from "@/mocks/server";
import { Component as InboxPage } from "@/routes/InboxPage";
import { renderApp, renderWithProviders } from "@/testUtils";
import { relativeTime } from "./relativeTime";

const SEED_APPROVAL = "Five coastal towns that fit the brief";
const SEED_QUESTION = /Do you prefer flying from the city airport/;
const PARTNER_APPROVAL = "Accommodation shortlist for Partner";

beforeEach(() => {
	localStorage.setItem("iris.userId", "1");
});

/** An approval explicitly addressed to the other user, newer than the seed. */
async function addPartnerApproval() {
	await api.POST("/api/tasks/{id}/approvals", {
		params: { path: { id: 3 } },
		body: { kind: "proceed", summary: PARTNER_APPROVAL, approverUserId: 2 },
	});
}

const items = () => screen.findAllByRole("article");

describe("Needs you inbox", () => {
	test("lists approvals and questions newest first with context", async () => {
		await addPartnerApproval();
		renderWithProviders(<InboxPage />, "/inbox");

		const cards = await items();
		expect(cards).toHaveLength(3);
		expect(within(cards[0]).getByText(PARTNER_APPROVAL)).toBeInTheDocument();
		expect(within(cards[1]).getByText(SEED_APPROVAL)).toBeInTheDocument();
		expect(within(cards[2]).getByText(SEED_QUESTION)).toBeInTheDocument();

		const approval = cards[1];
		expect(within(approval).getByText("Sign-off")).toBeInTheDocument();
		expect(within(approval).getByText("Summer trip")).toBeInTheDocument();
		expect(within(approval).getByText(/Cadaques/)).toBeInTheDocument();
		expect(within(approval).getByText(/45m ago/)).toBeInTheDocument();
		expect(
			within(approval).getByRole("link", { name: "Shortlist coastal towns" }),
		).toHaveAttribute("href", "/projects/1?task=2");
		expect(within(cards[2]).getByText("Question")).toBeInTheDocument();
	});

	test("Addressed to me hides approvals for the other user and is kept in the URL", async () => {
		await addPartnerApproval();
		renderWithProviders(<InboxPage />, "/inbox?mine=1");

		await screen.findByText(SEED_APPROVAL);
		expect(screen.queryByText(PARTNER_APPROVAL)).not.toBeInTheDocument();
		expect(screen.getByText(SEED_QUESTION)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Addressed to me" }),
		).toHaveAttribute("aria-pressed", "true");

		await userEvent.click(screen.getByRole("button", { name: "All" }));
		expect(await screen.findByText(PARTNER_APPROVAL)).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole("button", { name: "Addressed to me" }),
		);
		await waitFor(() =>
			expect(screen.queryByText(PARTNER_APPROVAL)).not.toBeInTheDocument(),
		);
	});

	test("shows the empty state", async () => {
		db.approvals = [];
		db.comments = [];
		renderWithProviders(<InboxPage />, "/inbox");
		expect(
			await screen.findByText("Nothing needs you right now"),
		).toBeInTheDocument();
	});

	test("shows an error with retry when loading fails", async () => {
		server.use(
			http.get("/api/approvals", () =>
				HttpResponse.json({ message: "boom" }, { status: 400 }),
			),
		);
		renderWithProviders(<InboxPage />, "/inbox");
		expect(
			await screen.findByText("Could not load the inbox."),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
	});

	test("approving removes the item and updates the task", async () => {
		renderWithProviders(<InboxPage />, "/inbox");
		const card = (await items())[0];

		await userEvent.click(
			within(card).getByRole("button", { name: "Approve" }),
		);

		await waitFor(() =>
			expect(screen.queryByText(SEED_APPROVAL)).not.toBeInTheDocument(),
		);
		await waitFor(() =>
			expect(db.tasks.find((t) => t.id === 2)?.status).toBe("done"),
		);
		expect(db.approvals[0].state).toBe("approved");
	});

	test("rejecting and requesting changes need a comment", async () => {
		renderWithProviders(<InboxPage />, "/inbox");
		const card = (await items())[0];
		const reject = within(card).getByRole("button", { name: "Reject" });
		const changes = within(card).getByRole("button", {
			name: "Request changes",
		});

		expect(reject).toBeDisabled();
		expect(changes).toBeDisabled();
		expect(
			within(card).getByText(
				/comment is required to request changes or reject/,
			),
		).toBeInTheDocument();

		await userEvent.type(within(card).getByLabelText("Comment"), "Not these");
		expect(reject).toBeEnabled();
		await userEvent.click(reject);

		await waitFor(() =>
			expect(screen.queryByText(SEED_APPROVAL)).not.toBeInTheDocument(),
		);
		await waitFor(() => expect(db.approvals[0].state).toBe("rejected"));
		expect(db.approvals[0].decisionComment).toBe("Not these");
	});

	test("a failed decision restores the item and shows an error", async () => {
		server.use(
			http.post("/api/approvals/:id/decide", () =>
				HttpResponse.json({ message: "Already decided" }, { status: 409 }),
			),
		);
		renderWithProviders(<InboxPage />, "/inbox");
		const card = (await items())[0];

		await userEvent.click(
			within(card).getByRole("button", { name: "Approve" }),
		);

		expect(await screen.findByText("Already decided")).toBeInTheDocument();
		expect(await screen.findByText(SEED_APPROVAL)).toBeInTheDocument();
	});

	test("answering removes the question and moves the task back to ready", async () => {
		renderWithProviders(<InboxPage />, "/inbox");
		const card = (await items()).find((c) => within(c).queryByText("Question"));
		if (!card) throw new Error("question card missing");
		const answer = within(card).getByRole("button", { name: "Answer" });
		expect(answer).toBeDisabled();

		await userEvent.type(within(card).getByLabelText("Your answer"), "City");
		await userEvent.click(answer);

		await waitFor(() =>
			expect(screen.queryByText(SEED_QUESTION)).not.toBeInTheDocument(),
		);
		await waitFor(() =>
			expect(db.tasks.find((t) => t.id === 7)?.status).toBe("ready"),
		);
		const reply = db.comments.find((c) => c.kind === "answer");
		expect(reply?.bodyMd).toBe("City");
		expect(db.notes).toHaveLength(2);
	});

	test("Also save as project note creates a note", async () => {
		renderWithProviders(<InboxPage />, "/inbox");
		const card = (await items()).find((c) => within(c).queryByText("Question"));
		if (!card) throw new Error("question card missing");

		await userEvent.type(
			within(card).getByLabelText("Your answer"),
			"City airport",
		);
		await userEvent.click(
			within(card).getByRole("checkbox", { name: "Also save as project note" }),
		);
		await userEvent.click(within(card).getByRole("button", { name: "Answer" }));

		await waitFor(() => expect(db.notes).toHaveLength(3));
		expect(db.notes.at(-1)).toMatchObject({
			projectId: 1,
			bodyMd: "City airport",
		});
	});

	test("the nav badge counts items addressed to the signed-in user", async () => {
		await addPartnerApproval();
		renderApp("/");

		const link = await screen.findByRole("link", { name: /Needs you/ });
		await waitFor(() => expect(link).toHaveTextContent("2 waiting"));
	});
});

test("relativeTime", () => {
	const now = Date.parse("2026-01-10T12:00:00Z");
	const ago = (ms: number) => new Date(now - ms).toISOString();
	expect(relativeTime(ago(10_000), now)).toBe("just now");
	expect(relativeTime(ago(5 * 60_000), now)).toBe("5m ago");
	expect(relativeTime(ago(3 * 3600_000), now)).toBe("3h ago");
	expect(relativeTime(ago(2 * 86400_000), now)).toBe("2d ago");
});
