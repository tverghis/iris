import type { components } from "./schema";

type Schemas = components["schemas"];

export type User = Schemas["User"];
export type Actor = Schemas["Actor"];
export type TaskStatus = Schemas["TaskStatus"];
export type AssigneeKind = Schemas["AssigneeKind"];
export type ApprovalKind = Schemas["ApprovalKind"];
export type ApprovalState = Schemas["ApprovalState"];
export type RunState = Schemas["RunState"];
export type CommentKind = Schemas["CommentKind"];
export type Project = Schemas["Project"];
export type ProjectCreate = Schemas["ProjectCreate"];
export type ProjectPatch = Schemas["ProjectPatch"];
export type Board = Schemas["Board"];
export type BoardColumn = Schemas["BoardColumn"];
export type TaskCard = Schemas["TaskCard"];
export type Task = Schemas["Task"];
export type TaskCreate = Schemas["TaskCreate"];
export type TaskPatch = Schemas["TaskPatch"];
export type MoveTask = Schemas["MoveTask"];
export type DependencyRef = Schemas["DependencyRef"];
export type Comment = Schemas["Comment"];
export type CommentCreate = Schemas["CommentCreate"];
export type Note = Schemas["Note"];
export type NoteCreate = Schemas["NoteCreate"];
export type NotePatch = Schemas["NotePatch"];
export type Approval = Schemas["Approval"];
export type ApprovalCreate = Schemas["ApprovalCreate"];
export type ApprovalDecision = Schemas["ApprovalDecision"];
export type ApprovalInboxItem = Schemas["ApprovalInboxItem"];
export type QuestionInboxItem = Schemas["QuestionInboxItem"];
export type Run = Schemas["Run"];
export type RunContext = Schemas["RunContext"];
export type DispatchStatus = Schemas["DispatchStatus"];
export type ApiEvent = Schemas["Event"];
export type StreamEvent = Schemas["StreamEvent"];

export const TASK_STATUSES: readonly TaskStatus[] = [
	"backlog",
	"ready",
	"in_progress",
	"needs_approval",
	"blocked",
	"done",
];
