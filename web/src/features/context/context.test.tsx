import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Note, Project } from "@/api/types";
import { renderApp } from "@/testUtils";

const route = "/projects/1/context";

async function serverProject() {
	return (await api.GET("/api/projects/{id}", { params: { path: { id: 1 } } }))
		.data as Project;
}

async function serverNotes() {
	return (
		await api.GET("/api/projects/{id}/notes", { params: { path: { id: 1 } } })
	).data as Note[];
}

const noteItems = async () =>
	within(await screen.findByRole("list")).getAllByRole("listitem");

test("links back to the board", async () => {
	renderApp(route);
	expect(
		await screen.findByRole("link", { name: "Summer trip board" }),
	).toHaveAttribute("href", "/projects/1");
});

test("edits and saves the brief, with dirty indicator", async () => {
	const user = userEvent.setup();
	renderApp(route);
	const box = await screen.findByLabelText("Brief (Markdown)");
	expect(screen.getByText("Saved")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

	await user.type(box, " extra");
	expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "Save" }));

	await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
	expect((await serverProject()).briefMd).toMatch(/ extra$/);
});

test("saves the brief with Ctrl+Enter", async () => {
	const user = userEvent.setup();
	renderApp(route);
	const box = await screen.findByLabelText("Brief (Markdown)");

	await user.type(box, "!{Control>}{Enter}{/Control}");

	await waitFor(async () =>
		expect((await serverProject()).briefMd).toMatch(/!$/),
	);
});

test("preview renders Markdown without raw HTML", async () => {
	const user = userEvent.setup();
	renderApp(route);
	const box = await screen.findByLabelText("Brief (Markdown)");
	await user.clear(box);
	await user.click(box);
	await user.paste("# Big goal\n\n- one\n- two\n\n<b>raw</b>");

	await user.click(screen.getByRole("tab", { name: "preview" }));

	expect(
		await screen.findByRole("heading", { name: "Big goal" }),
	).toBeInTheDocument();
	expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
	expect(document.querySelector("b")).toBeNull();
});

test("lists pinned notes first, then newest first, with authors", async () => {
	renderApp(route);
	const items = await noteItems();

	expect(items).toHaveLength(2);
	expect(items[0]).toHaveTextContent("second half of August");
	expect(items[0]).toHaveAttribute("data-pinned", "true");
	expect(items[1]).toHaveTextContent("Agent");
});

test("adds a note, then pins it to the top", async () => {
	const user = userEvent.setup();
	renderApp(route);
	await noteItems();

	await user.type(screen.getByLabelText("New note"), "Book early");
	await user.click(screen.getByRole("button", { name: "Add note" }));

	await waitFor(async () => expect(await noteItems()).toHaveLength(3));
	expect((await noteItems())[1]).toHaveTextContent("Book early");
	expect(screen.getByLabelText("New note")).toHaveValue("");

	await user.click(
		within((await noteItems())[1]).getByRole("button", { name: "Pin" }),
	);
	await waitFor(async () =>
		expect((await noteItems())[0]).toHaveTextContent("Book early"),
	);
	await waitFor(async () =>
		expect((await serverNotes()).filter((n) => n.pinned)).toHaveLength(2),
	);
});

test("a note created through the API appears after invalidation", async () => {
	const { queryClient } = renderApp(route);
	await noteItems();

	await api.POST("/api/projects/{id}/notes", {
		params: { path: { id: 1 } },
		body: { bodyMd: "From the inbox" },
	});
	await queryClient.invalidateQueries({
		queryKey: queryKeys.projects.notes(1),
	});

	expect(await screen.findByText("From the inbox")).toBeInTheDocument();
});

test("edits a note inline", async () => {
	const user = userEvent.setup();
	renderApp(route);
	const item = (await noteItems())[1];

	await user.click(within(item).getByRole("button", { name: "Edit" }));
	const box = screen.getByLabelText("Edit note");
	await user.clear(box);
	await user.type(box, "Trains run until 23:00");
	await user.click(screen.getByRole("button", { name: "Save note" }));

	expect(await screen.findByText("Trains run until 23:00")).toBeInTheDocument();
	await waitFor(async () =>
		expect((await serverNotes()).map((n) => n.bodyMd)).toContain(
			"Trains run until 23:00",
		),
	);
});

test("deletes a note after confirming", async () => {
	const user = userEvent.setup();
	const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
	vi.stubGlobal("confirm", confirm);
	renderApp(route);
	const item = (await noteItems())[1];

	await user.click(within(item).getByRole("button", { name: "Delete" }));
	expect(await noteItems()).toHaveLength(2);

	await user.click(
		within((await noteItems())[1]).getByRole("button", { name: "Delete" }),
	);
	await waitFor(async () => expect(await noteItems()).toHaveLength(1));
	expect(await serverNotes()).toHaveLength(1);
});
