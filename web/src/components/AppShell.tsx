import { FolderKanban, Inbox } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link, useRoute } from "wouter";
import { useInboxCount } from "@/features/inbox/useInboxCount";
import { cn } from "@/lib/utils";
import { AppRoutes } from "@/routes";
import { DispatcherStatus } from "./DispatcherStatus";
import { UserSwitcher } from "./UserSwitcher";

const Toaster = lazy(() =>
	import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })),
);

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
	const [isActive] = useRoute(to);
	return (
		<Link
			to={to}
			aria-current={isActive ? "page" : undefined}
			className={cn(
				"inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium hover:bg-accent",
				isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
			)}
		>
			{children}
		</Link>
	);
}

function InboxBadge() {
	const count = useInboxCount();
	if (count === 0) return null;
	return (
		<span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs text-primary-foreground">
			{count}
			<span className="sr-only"> waiting</span>
		</span>
	);
}

export function AppShell() {
	return (
		<div className="flex min-h-dvh flex-col">
			<header className="border-b px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2">
					<Link to="/" className="text-lg font-semibold">
						Iris
					</Link>
					<nav aria-label="Main" className="flex items-center gap-1">
						<NavLink to="/">
							<FolderKanban className="size-4" aria-hidden />
							<span className="sr-only sm:not-sr-only">Projects</span>
						</NavLink>
						<NavLink to="/inbox">
							<Inbox className="size-4" aria-hidden />
							<span className="sr-only sm:not-sr-only">Needs you</span>
							<InboxBadge />
						</NavLink>
					</nav>
					<div className="ml-auto">
						<UserSwitcher />
					</div>
					<div className="basis-full sm:order-last sm:basis-auto">
						<DispatcherStatus />
					</div>
				</div>
			</header>
			<main className="mx-auto w-full max-w-6xl flex-1 p-4">
				<AppRoutes />
			</main>
			<Suspense fallback={null}>
				<Toaster position="bottom-center" />
			</Suspense>
		</div>
	);
}
