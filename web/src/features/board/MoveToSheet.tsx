import { Check } from "lucide-react";
import type { TaskCard, TaskStatus } from "@/api/types";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { COLUMN_TITLES } from "./boardModel";

const STATUSES = Object.keys(COLUMN_TITLES) as TaskStatus[];

interface Props {
	task: TaskCard | null;
	onClose: () => void;
	onMove: (task: TaskCard, status: TaskStatus) => void;
}

/** Action sheet listing the columns; the accessible way to move a card. */
export default function MoveToSheet({ task, onClose, onMove }: Props) {
	return (
		<Sheet open={task !== null} onOpenChange={(open) => !open && onClose()}>
			<SheetContent side="bottom" className="mx-auto max-w-md gap-0">
				<SheetHeader className="pr-14">
					<SheetTitle>Move to…</SheetTitle>
					<SheetDescription className="break-words">
						{task?.title}
					</SheetDescription>
				</SheetHeader>
				<ul className="flex flex-col px-2 pb-3">
					{STATUSES.map((status) => {
						const current = task?.status === status;
						return (
							<li key={status}>
								<button
									type="button"
									disabled={current}
									aria-current={current || undefined}
									onClick={() => task && onMove(task, status)}
									className={cn(
										"flex min-h-12 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
										current && "text-muted-foreground",
									)}
								>
									{COLUMN_TITLES[status]}
									{current && (
										<span className="flex items-center gap-1 text-xs">
											<Check className="size-4" aria-hidden />
											Current
										</span>
									)}
								</button>
							</li>
						);
					})}
				</ul>
			</SheetContent>
		</Sheet>
	);
}
