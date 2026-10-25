import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Note, NoteCreate, NotePatch, Project } from "@/api/types";

export function sortNotes(notes: Note[]) {
	return notes.toSorted(
		(a, b) =>
			Number(b.pinned) - Number(a.pinned) ||
			b.createdAt.localeCompare(a.createdAt) ||
			b.id - a.id,
	);
}

export function useProject(id: number) {
	return useQuery({
		queryKey: queryKeys.projects.detail(id),
		queryFn: async () =>
			(await api.GET("/api/projects/{id}", { params: { path: { id } } }))
				.data as Project,
	});
}

export function useNotes(projectId: number) {
	return useQuery({
		queryKey: queryKeys.projects.notes(projectId),
		queryFn: async () =>
			(
				await api.GET("/api/projects/{id}/notes", {
					params: { path: { id: projectId } },
				})
			).data as Note[],
		select: sortNotes,
	});
}

export function useSaveBrief(projectId: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (briefMd: string) =>
			(
				await api.PATCH("/api/projects/{id}", {
					params: { path: { id: projectId } },
					body: { briefMd },
				})
			).data as Project,
		onSuccess: (project) => {
			queryClient.setQueryData(queryKeys.projects.detail(projectId), project);
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useCreateNote(projectId: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (body: NoteCreate) =>
			(
				await api.POST("/api/projects/{id}/notes", {
					params: { path: { id: projectId } },
					body,
				})
			).data as Note,
		onSettled: () =>
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.notes(projectId),
			}),
	});
}

/** Runs `change` on the cached list immediately; rolls back if the request fails. */
async function optimistic(
	queryClient: QueryClient,
	projectId: number,
	change: (notes: Note[]) => Note[],
) {
	const key = queryKeys.projects.notes(projectId);
	await queryClient.cancelQueries({ queryKey: key });
	const previous = queryClient.getQueryData<Note[]>(key);
	if (previous) queryClient.setQueryData(key, change(previous));
	return { previous };
}

function rollback(
	queryClient: QueryClient,
	projectId: number,
	context?: { previous?: Note[] },
) {
	if (context?.previous) {
		queryClient.setQueryData(
			queryKeys.projects.notes(projectId),
			context.previous,
		);
	}
}

export function useUpdateNote(projectId: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, ...body }: NotePatch & { id: number }) => {
			await api.PATCH("/api/notes/{id}", { params: { path: { id } }, body });
		},
		onMutate: ({ id, ...patch }) =>
			optimistic(queryClient, projectId, (notes) =>
				notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
			),
		onError: (_e, _v, context) => rollback(queryClient, projectId, context),
		onSettled: () =>
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.notes(projectId),
			}),
	});
}

export function useDeleteNote(projectId: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: number) => {
			await api.DELETE("/api/notes/{id}", { params: { path: { id } } });
		},
		onMutate: (id) =>
			optimistic(queryClient, projectId, (notes) =>
				notes.filter((n) => n.id !== id),
			),
		onError: (_e, _v, context) => rollback(queryClient, projectId, context),
		onSettled: () =>
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.notes(projectId),
			}),
	});
}
