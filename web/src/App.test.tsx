import { useQuery } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { expect, test } from "vitest";
import { api } from "@/api/client";
import { parseErrorMessage } from "@/api/errors";
import { server } from "@/mocks/server";
import { renderApp, renderWithProviders } from "./testUtils";

test.each([
	["/", "Projects"],
	["/projects/1", "Summer trip"],
	["/projects/1/context", "Project context"],
	["/inbox", "Needs you"],
])("route %s renders", async (path, heading) => {
	renderApp(path);

	expect(
		await screen.findByRole("heading", { name: heading }),
	).toBeInTheDocument();
	expect(screen.getByRole("link", { name: "Iris" })).toHaveAttribute(
		"href",
		"/",
	);
	expect(
		await screen.findByRole("button", { name: "Run now" }),
	).toBeInTheDocument();
});

function Failing() {
	useQuery({
		queryKey: ["failing"],
		queryFn: async () => (await api.GET("/api/projects")).data,
	});
	return null;
}

test("a failed request shows the server message in a toast", async () => {
	server.use(
		http.get("/api/projects", () =>
			HttpResponse.json({ message: "Database is on fire" }, { status: 500 }),
		),
	);
	renderWithProviders(<Failing />);

	expect(
		await screen.findByText("Database is on fire", {}, { timeout: 10_000 }),
	).toBeInTheDocument();
});

test("error bodies in RFC 7807 form or without JSON fall back sensibly", async () => {
	const problem = new Response(JSON.stringify({ title: "T", detail: "D" }), {
		status: 400,
	});
	expect(await parseErrorMessage(problem)).toBe("D");
	const plain = new Response("nope", {
		status: 502,
		statusText: "Bad Gateway",
	});
	expect(await parseErrorMessage(plain)).toBe("Bad Gateway");
});

test("the user switcher persists the user and sends X-Iris-User", async () => {
	const seen: (string | null)[] = [];
	server.use(
		http.get("/api/projects", ({ request }) => {
			seen.push(request.headers.get("X-Iris-User"));
			return HttpResponse.json([]);
		}),
	);
	renderApp("/");

	const select = await screen.findByRole("combobox", { name: "Signed in as" });
	await waitFor(() => expect(select).toHaveValue("1"));
	await userEvent.selectOptions(select, "Partner");

	expect(localStorage.getItem("iris.userId")).toBe("2");
	await api.GET("/api/projects");
	expect(seen.at(-1)).toBe("2");
});
