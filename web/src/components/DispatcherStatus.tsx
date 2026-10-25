import { Button } from "@/components/ui/button";

/** Placeholder strip; wired to /api/dispatch/status and run-now later. */
export function DispatcherStatus() {
	return (
		<div className="flex items-center gap-2 text-sm text-muted-foreground">
			<span>Dispatcher: idle</span>
			<Button type="button" size="sm" variant="outline" disabled>
				Run now
			</Button>
		</div>
	);
}
