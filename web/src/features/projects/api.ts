import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Project } from "@/api/types";

const activeKey = queryKeys.projects.list(false);
const allKey = queryKeys.projects.list(true);

export function useProjects(includeArchived: boolean) {
	return useQuery({
		queryKey: queryKeys.projects.list(includeArchived),
		queryFn: async () =>
			(
				await api.GET("/api/projects", {
					params: { query: { includeArchived } },
				})
			).data as Project[],
	});
}

export function useCreateProject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (name: string) =>
			(await api.POST("/api/projects", { body: { name } })).data as Project,
		onSuccess: (project) => {
			for (const key of [activeKey, allKey]) {
				queryClient.setQueryData<Project[]>(
					key,
					(old) => old && [project, ...old],
				);
			}
			queryClient.setQueryData(queryKeys.projects.detail(project.id), project);
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

/** Archive or unarchive, updating both list caches optimistically. */
export function useSetArchived() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, archived }: { id: number; archived: boolean }) =>
			(
				await api.PATCH("/api/projects/{id}", {
					params: { path: { id } },
					body: { archived },
				})
			).data as Project,
		onMutate: async ({ id, archived }) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
			const previous = {
				active: queryClient.getQueryData<Project[]>(activeKey),
				all: queryClient.getQueryData<Project[]>(allKey),
			};
			const archivedAt = archived ? new Date().toISOString() : null;

			queryClient.setQueryData<Project[]>(allKey, (old) =>
				old?.map((p) => (p.id === id ? { ...p, archivedAt } : p)),
			);
			if (archived) {
				queryClient.setQueryData<Project[]>(activeKey, (old) =>
					old?.filter((p) => p.id !== id),
				);
			} else {
				const project = previous.all?.find((p) => p.id === id);
				if (project) {
					queryClient.setQueryData<Project[]>(
						activeKey,
						(old) => old && [{ ...project, archivedAt }, ...old],
					);
				}
			}
			return previous;
		},
		onError: (_error, _vars, previous) => {
			if (!previous) return;
			queryClient.setQueryData(activeKey, previous.active);
			queryClient.setQueryData(allKey, previous.all);
		},
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
	});
}
