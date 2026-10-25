import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";

// Loaded on demand so the Markdown renderer never lands in the board's first load.
const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

const prose = cn(
	"min-w-0 break-words text-sm leading-relaxed",
	"[&>*+*]:mt-3",
	"[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold",
	"[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-1",
	"[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
	"[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
	"[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
	"[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
	"[&_table]:block [&_table]:overflow-x-auto [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:px-2 [&_td]:py-1",
	"[&_hr]:border-border",
);

/** Renders Markdown safely (no raw HTML), lazily loading the renderer. */
export function Markdown({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<div className={cn(prose, className)}>
			<Suspense fallback={<p className="whitespace-pre-wrap">{children}</p>}>
				<MarkdownRenderer>{children}</MarkdownRenderer>
			</Suspense>
		</div>
	);
}
