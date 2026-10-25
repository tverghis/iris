import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/toast";
import { ApiError } from "./errors";
import { PERSIST_GC_TIME } from "./persistence";

declare module "@tanstack/react-query" {
	interface Register {
		mutationMeta: { silent?: boolean };
		queryMeta: { silent?: boolean };
	}
}

function notify(error: Error, silent?: boolean) {
	if (silent) return;
	toastError(error.message || "Something went wrong");
}

export function createQueryClient({ persisted = false } = {}) {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => notify(error, query.meta?.silent),
		}),
		mutationCache: new MutationCache({
			onError: (error, _vars, _ctx, mutation) =>
				notify(error, mutation.meta?.silent),
		}),
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				...(persisted && { gcTime: PERSIST_GC_TIME }),
				retry: (count, error) =>
					count < 1 && !(error instanceof ApiError && error.status < 500),
				refetchOnWindowFocus: true,
			},
		},
	});
}
