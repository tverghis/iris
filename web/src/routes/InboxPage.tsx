import { useSearchParams } from "wouter";
import { Button } from "@/components/ui/button";
import { ApprovalCard, QuestionCard } from "@/features/inbox/InboxItems";
import { useInbox } from "@/features/inbox/useInbox";

function FilterButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Button
			type="button"
			size="sm"
			variant={active ? "default" : "outline"}
			aria-pressed={active}
			onClick={onClick}
			className="flex-1 sm:flex-none"
		>
			{children}
		</Button>
	);
}

export function Component() {
	const [params, setParams] = useSearchParams();
	const mine = params.get("mine") === "1";
	const { entries, isPending, isError, refetch } = useInbox({ mine });

	const setMine = (value: boolean) =>
		setParams(
			(prev) => {
				if (value) prev.set("mine", "1");
				else prev.delete("mine");
				return prev;
			},
			{ replace: true },
		);

	return (
		<section className="mx-auto max-w-2xl space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h1 className="text-xl font-semibold">Needs you</h1>
				<fieldset
					aria-label="Filter"
					className="flex w-full gap-2 border-0 p-0 sm:w-auto"
				>
					<FilterButton active={mine} onClick={() => setMine(true)}>
						Addressed to me
					</FilterButton>
					<FilterButton active={!mine} onClick={() => setMine(false)}>
						All
					</FilterButton>
				</fieldset>
			</div>

			{isPending ? (
				<p className="text-sm text-muted-foreground">Loading…</p>
			) : isError ? (
				<div className="space-y-2 text-sm">
					<p>Could not load the inbox.</p>
					<Button type="button" size="sm" variant="outline" onClick={refetch}>
						Retry
					</Button>
				</div>
			) : entries.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground">
					Nothing needs you right now
				</p>
			) : (
				<ul className="space-y-3">
					{entries.map((entry) => (
						<li key={entry.key}>
							{entry.type === "approval" ? (
								<ApprovalCard item={entry.item} />
							) : (
								<QuestionCard item={entry.item} />
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
