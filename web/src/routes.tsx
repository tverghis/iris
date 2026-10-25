import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";

const lazyPage = (load: () => Promise<{ Component: React.ComponentType }>) =>
	lazy(async () => ({ default: (await load()).Component }));

const ProjectsPage = lazyPage(() => import("./routes/ProjectsPage"));
const BoardPage = lazyPage(() => import("./routes/BoardPage"));
const ProjectContextPage = lazyPage(
	() => import("./routes/ProjectContextPage"),
);
const InboxPage = lazyPage(() => import("./routes/InboxPage"));

/** Route table; pages are code-split so the shell stays small. */
export function AppRoutes() {
	return (
		<Suspense fallback={null}>
			<Switch>
				<Route path="/" component={ProjectsPage} />
				<Route path="/projects/:projectId" component={BoardPage} />
				<Route
					path="/projects/:projectId/context"
					component={ProjectContextPage}
				/>
				<Route path="/inbox" component={InboxPage} />
			</Switch>
		</Suspense>
	);
}
