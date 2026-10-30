import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const SavedAnalysesPage = lazy(() => import("./pages/saved-analyses/page"));
const ExamplePage = lazy(() => import("./pages/saved-analyses/example/page"));
const ConsentOverviewPage = lazy(() => import("./pages/consent-overview/page"));
// feature:new inserts imports above this line.

export const appRoutes: RouteObject[] = [
  { path: "/saved-analyses", element: <SavedAnalysesPage /> },
  { path: "/saved-analyses/example", element: <ExamplePage /> },
  { path: "/consent-overview", element: <ConsentOverviewPage /> },
  // feature:new inserts routes above this line.
  { path: "*", element: <p>Cette page n’existe pas.</p> },
];
