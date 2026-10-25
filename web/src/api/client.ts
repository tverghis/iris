import createClient, { type Middleware } from "openapi-fetch";
import { getCurrentUserId } from "@/lib/currentUser";
import { ApiError, parseErrorMessage } from "./errors";
import type { paths } from "./schema";

const middleware: Middleware = {
	onRequest({ request }) {
		const userId = getCurrentUserId();
		if (userId !== null) request.headers.set("X-Iris-User", String(userId));
		return request;
	},
	async onResponse({ response }) {
		if (!response.ok) {
			throw new ApiError(response.status, await parseErrorMessage(response));
		}
		return response;
	},
};

export const api = createClient<paths>({
	// Same origin; an absolute URL keeps Request construction valid in jsdom too.
	baseUrl: typeof location === "undefined" ? "" : location.origin,
	fetch: (request) => globalThis.fetch(request),
});
api.use(middleware);

export { ApiError };
