export class ApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

function pick(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value : undefined;
}

/** Server message from `{ message }` or RFC 7807 `{ detail | title }`, else the status text. */
export async function parseErrorMessage(response: Response): Promise<string> {
	try {
		const body: unknown = JSON.parse(await response.text());
		if (body && typeof body === "object") {
			const record = body as Record<string, unknown>;
			const found =
				pick(record.message) ?? pick(record.detail) ?? pick(record.title);
			if (found) return found;
		}
	} catch {
		// not JSON; fall through
	}
	return response.statusText || `Request failed (${response.status})`;
}
