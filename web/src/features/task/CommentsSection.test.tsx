import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { handleStreamEvent } from "@/features/live/handleEvent";
import { agentActor, db } from "@/mocks/db";
import { renderApp } from "@/testUtils";

const QUESTION = /Do you prefer flying from the city airport/;
const idOf = (title: string) =>
	db.tasks.find((t) => t.title === title)?.id as number;
const statusOfCard = (title: string) =>
	screen
		.getByRole("button", { name: new RegExp(`^${title}`), hidden: true })
		.closest("[data-status]")
		?.getAttribute("data-status");

beforeEach(() => {
	localStorage.setItem("iris.userId", "1");
});

describe("task comments", () => {
	test("an open question blocks the task; a human answer returns it to Ready and can save a note", async () => {
		const user = userEvent.setup();
		const id = idOf("Which airport do you prefer?");
		renderApp(`/projects/1?task=${id}`);

		const question = (
			await screen.findByText(QUESTION, {}, { timeout: 10_000 })
		).closest("li") as HTMLElement;
		expect(within(question).getByText(/Question · open/)).toBeInTheDocument();
		expect(within(question).getByText("Agent")).toBeInTheDocument();
		expect(screen.getByText(/Blocked · created by/)).toBeInTheDocument();
		await waitFor(() => expect(statusOfCard("Which airport")).toBe("blocked"));

		await user.click(within(question).getByRole("button", { name: "Answer" }));
		await user.click(
			screen.getByRole("checkbox", { name: "Also save as project note" }),
		);
		await user.type(screen.getByLabelText("Answer"), "The city airport");
		await user.keyboard("{Control>}{Enter}{/Control}");

		const reply = await screen.findByText(/replying to question/);
		const item = reply.closest("li") as HTMLElement;
		expect(within(item).getByText("The city airport")).toBeInTheDocument();
		expect(within(item).getByText("Answer")).toBeInTheDocument();
		expect(within(item).getByText(/replying to question/)).toBeInTheDocument();
		await waitFor(() =>
			expect(screen.getByText(/Ready · created by/)).toBeInTheDocument(),
		);
		await waitFor(() => expect(statusOfCard("Which airport")).toBe("ready"));
		expect(screen.getByText(/Question · answered/)).toBeInTheDocument();
		await waitFor(() =>
			expect(db.notes.some((n) => n.bodyMd === "The city airport")).toBe(true),
		);
	});

	test("plain comments append and a stream event refetches new ones", async () => {
		const user = userEvent.setup();
		const id = idOf("Draft packing list");
		const { queryClient } = renderApp(`/projects/1?task=${id}`);
		expect(
			await screen.findByText("No comments yet", {}, { timeout: 10_000 }),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Answer" })).toBeNull();

		await user.type(screen.getByLabelText("New comment"), "Pack **light**");
		await user.click(screen.getByRole("button", { name: "Comment" }));
		expect(await screen.findByText("light")).toBeInTheDocument();
		await waitFor(() =>
			expect(db.comments.filter((c) => c.taskId === id)).toHaveLength(1),
		);

		db.comments.push({
			id: 9001,
			taskId: id,
			author: agentActor,
			bodyMd: "Found a checklist online",
			kind: "comment",
			replyToId: null,
			resolvedAt: null,
			createdAt: new Date().toISOString(),
		});
		act(() =>
			handleStreamEvent(queryClient, 1, {
				type: "comment.created",
				taskId: id,
			}),
		);
		expect(
			await screen.findByText("Found a checklist online"),
		).toBeInTheDocument();
	});
});
