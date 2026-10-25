import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import type { Project } from "@/api/types";
import { renderWithProviders } from "@/testUtils";
import { BriefEditor } from "./BriefEditor";

const project = (briefMd: string): Project => ({
	id: 1,
	name: "Summer trip",
	briefMd,
	archivedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	needsApprovalCount: 0,
	blockedCount: 0,
	agentRunning: false,
});

function Harness() {
	const [brief, setBrief] = useState("Original");
	return (
		<>
			<button type="button" onClick={() => setBrief("Changed by someone")}>
				remote change
			</button>
			<BriefEditor project={project(brief)} />
		</>
	);
}

const box = () => screen.getByLabelText("Brief (Markdown)");

test("a clean draft follows a remote change", async () => {
	const user = userEvent.setup();
	renderWithProviders(<Harness />);
	expect(box()).toHaveValue("Original");

	await user.click(screen.getByRole("button", { name: "remote change" }));

	expect(box()).toHaveValue("Changed by someone");
	expect(screen.getByText("Saved")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
});

test("an edited draft is kept on a remote change, with a notice", async () => {
	const user = userEvent.setup();
	renderWithProviders(<Harness />);
	await user.type(box(), " + mine");

	await user.click(screen.getByRole("button", { name: "remote change" }));

	expect(box()).toHaveValue("Original + mine");
	expect(screen.getByText(/Brief changed elsewhere/)).toBeInTheDocument();
	expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

	await user.click(screen.getByRole("button", { name: "Use latest" }));
	expect(box()).toHaveValue("Changed by someone");
	expect(screen.queryByText(/Brief changed elsewhere/)).not.toBeInTheDocument();
	expect(screen.getByText("Saved")).toBeInTheDocument();
});
