import {
	type CollisionDetection,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	pointerWithin,
	rectIntersection,
} from "@dnd-kit/core";
import {
	lazy,
	Suspense,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";
import { Link, useSearchParams } from "wouter";
import { ApiError } from "@/api/client";
import type {
	BoardColumn as BoardColumnData,
	TaskCard,
	TaskStatus,
} from "@/api/types";
import { Button } from "@/components/ui/button";
import { useProjectStream } from "@/features/live/useProjectStream";
import { TaskDrawerMount } from "@/features/task/TaskDrawerMount";
import { useCurrentUserId } from "@/lib/currentUser";
import { useIsMobile } from "@/lib/useMediaQuery";
import { BoardColumn } from "./BoardColumn";
import {
	type BoardFilter,
	columnDropId,
	columnIds,
	type DragId,
	filterColumns,
	moveTaskInColumns,
	parseFilter,
	resolveDrop,
} from "./boardModel";
import { useBoardSensors } from "./dndSensors";
import { TaskCardOverlay } from "./TaskCard";
import { useBoard, useMoveTask, useUsers } from "./useBoard";
import { useColumnCollapse } from "./useColumnCollapse";

const MoveToSheet = lazy(() => import("./MoveToSheet"));

const FILTERS: { value: BoardFilter; label: string }[] = [
	{ value: "mine", label: "Mine" },
	{ value: "agent", label: "Agent" },
	{ value: "all", label: "All" },
];

/** Prefer the card under the pointer, then the column; keyboard uses rects. */
const collisionDetection: CollisionDetection = (args) => {
	const hits = pointerWithin(args);
	const found = hits.length ? hits : rectIntersection(args);
	const card = found.find((h) => typeof h.id === "number");
	return card ? [card] : found.slice(0, 1);
};

interface DragState {
	taskId: number;
	/** Column the card was picked up from. */
	source: TaskStatus | undefined;
	/** Visible columns as previewed while dragging. */
	columns: BoardColumnData[];
}

export function BoardView({ projectId }: { projectId: number }) {
	const { project, columns, isPending, error, refetch } = useBoard(projectId);
	useProjectStream(projectId);
	const { data: users } = useUsers();
	const currentUserId = useCurrentUserId();
	const [params, setParams] = useSearchParams();
	const filter = parseFilter(params.get("filter"));

	const userNames = useMemo(
		() => new Map(users?.map((u) => [u.id, u.name]) ?? []),
		[users],
	);
	const visibleColumns = useMemo(
		() => (columns ? filterColumns(columns, filter, currentUserId) : []),
		[columns, filter, currentUserId],
	);
	const isMobile = useIsMobile();
	const collapse = useColumnCollapse(projectId);
	const sensors = useBoardSensors();
	const { move } = useMoveTask(projectId);
	const [drag, setDrag] = useState<DragState | null>(null);
	const shownColumns = drag?.columns ?? visibleColumns;
	const activeTask = drag
		? visibleColumns.flatMap((c) => c.tasks).find((t) => t.id === drag.taskId)
		: undefined;

	// Scroll anchoring across a layout change: remember where an element sits,
	// then restore that position once the new layout has committed.
	const anchor = useRef<{ selector: string; top: number } | null>(null);
	const anchorTo = (selector: string) => {
		const el = document.querySelector(selector);
		anchor.current = el
			? { selector, top: el.getBoundingClientRect().top }
			: null;
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs after each drag state change
	useLayoutEffect(() => {
		const a = anchor.current;
		anchor.current = null;
		const el = a && document.querySelector(a.selector);
		if (!a || !el) return;
		const delta = el.getBoundingClientRect().top - a.top;
		if (delta) window.scrollBy(0, delta);
	}, [drag?.taskId]);

	const onDragStart = ({ active }: DragStartEvent) => {
		const taskId = Number(active.id);
		const source = visibleColumns.find((c) =>
			c.tasks.some((t) => t.id === taskId),
		)?.status;
		if (isMobile && source) {
			// One layout change: collapse every other column, keep the card put.
			anchorTo(`[data-task-id="${taskId}"]`);
			flushSync(() => {
				setDrag({ taskId, source, columns: visibleColumns });
				collapse.setExpandedOnly([source]);
			});
			return;
		}
		setDrag({ taskId, source, columns: visibleColumns });
	};

	// On a phone every other column is collapsed, so a drop on one goes to the top.
	const columnDrop = (overId: DragId) =>
		isMobile && drag?.source && overId !== columnDropId(drag.source)
			? "top"
			: "end";

	const endDrag = (landedIn: TaskStatus | undefined) => {
		if (isMobile && drag) {
			anchorTo(`section[data-status="${landedIn ?? drag.source}"]`);
			collapse.setExpandedOnly(null);
		}
		setDrag(null);
	};

	const onDragOver = ({ active, over }: DragOverEvent) => {
		// On a phone the other columns are collapsed headers, so there is no
		// preview: moving the card out of its column would shift the headers
		// under the finger.
		if (!drag || !over || isMobile) return;
		const taskId = Number(active.id);
		const plan = resolveDrop(
			drag.columns,
			taskId,
			over.id,
			columnDrop(over.id),
		);
		const current = drag.columns.find((c) =>
			c.tasks.some((t) => t.id === taskId),
		);
		if (!plan || plan.status === current?.status) return;
		setDrag({
			...drag,
			columns: moveTaskInColumns(
				drag.columns,
				taskId,
				plan.status,
				plan.afterTaskId,
			),
		});
	};

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		const preview = drag?.columns ?? visibleColumns;
		const taskId = Number(active.id);
		const plan = over
			? resolveDrop(preview, taskId, over.id, columnDrop(over.id))
			: null;
		endDrag(plan?.status);
		if (!plan) return;
		const result = moveTaskInColumns(
			visibleColumns,
			taskId,
			plan.status,
			plan.afterTaskId,
		);
		if (
			JSON.stringify(columnIds(result)) ===
			JSON.stringify(columnIds(visibleColumns))
		) {
			return;
		}
		move({ taskId, ...plan });
	};

	const setFilter = (next: BoardFilter) =>
		setParams(
			(prev) => {
				if (next === "all") prev.delete("filter");
				else prev.set("filter", next);
				return prev;
			},
			{ replace: true },
		);

	const [menu, setMenu] = useState<{ task: TaskCard | null } | null>(null);
	const openMenu = useCallback((task: TaskCard) => setMenu({ task }), []);

	const openTask = useCallback(
		(taskId: number) =>
			setParams((prev) => {
				prev.set("task", String(taskId));
				return prev;
			}),
		[setParams],
	);

	if (isPending) {
		return <p className="text-sm text-muted-foreground">Loading board…</p>;
	}
	if (error || !project) {
		if (error instanceof ApiError && error.status === 404) {
			return (
				<div>
					<h1 className="text-xl font-semibold">Project not found</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						This project does not exist or was removed.{" "}
						<Link to="/" className="underline">
							Back to projects
						</Link>
					</p>
				</div>
			);
		}
		return (
			<div role="alert">
				<p className="text-sm">Could not load the board.</p>
				<Button className="mt-2" variant="outline" onClick={() => refetch()}>
					Retry
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 md:h-[calc(100dvh-8rem)] md:min-h-96">
			<header className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<h1 className="text-xl font-semibold">{project.name}</h1>
				<Link
					to={`/projects/${projectId}/context`}
					className="text-sm text-muted-foreground underline"
				>
					Project context
				</Link>
				<fieldset className="ml-auto flex min-w-0 gap-1 border-0 p-0">
					<legend className="sr-only">Filter</legend>
					{FILTERS.map((f) => (
						<Button
							key={f.value}
							size="sm"
							variant={filter === f.value ? "default" : "outline"}
							aria-pressed={filter === f.value}
							onClick={() => setFilter(f.value)}
						>
							{f.label}
						</Button>
					))}
				</fieldset>
			</header>
			<div
				data-board-scroll
				className="flex min-h-0 flex-1 flex-col gap-3 pb-2 md:flex-row md:overflow-x-auto md:overscroll-x-contain"
			>
				<DndContext
					autoScroll={{ threshold: { x: 0.1, y: 0.15 }, acceleration: 3 }}
					sensors={sensors}
					collisionDetection={collisionDetection}
					onDragStart={onDragStart}
					onDragOver={onDragOver}
					onDragEnd={onDragEnd}
					onDragCancel={() => endDrag(undefined)}
				>
					{shownColumns.map((column) => (
						<BoardColumn
							key={column.status}
							projectId={projectId}
							column={column}
							userNames={userNames}
							onOpenTask={openTask}
							onMenuTask={openMenu}
							collapsible={isMobile}
							collapsed={collapse.isCollapsed(column.status)}
							onToggleCollapsed={collapse.toggle}
						/>
					))}
					<DragOverlay dropAnimation={null}>
						{activeTask && (
							<TaskCardOverlay
								task={activeTask}
								userName={
									activeTask.assigneeUserId === null
										? undefined
										: userNames.get(activeTask.assigneeUserId)
								}
								onOpen={openTask}
							/>
						)}
					</DragOverlay>
				</DndContext>
			</div>
			{menu && (
				<Suspense fallback={null}>
					<MoveToSheet
						task={menu.task}
						onClose={() => setMenu({ task: null })}
						onMove={(task, status) => {
							setMenu({ task: null });
							move({ taskId: task.id, status, afterTaskId: null });
						}}
					/>
				</Suspense>
			)}
			<TaskDrawerMount projectId={projectId} />
		</div>
	);
}
