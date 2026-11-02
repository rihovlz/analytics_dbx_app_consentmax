import { lazy } from "react";
import { Navigate, type RouteObject } from "react-router-dom";

const VisualizationsPage = lazy(() => import("./pages/visualizations/page"));
const SavedAnalysesPage = lazy(() => import("./pages/saved-analyses/page"));
const ExamplePage = lazy(() => import("./pages/saved-analyses/example/page"));
const ConsentOverviewPage = lazy(() => import("./pages/consent-overview/page"));
const AllianceContributionPage = lazy(() => import("./pages/alliance-contribution/page"));
const MissingsPage = lazy(() => import("./pages/missings/page"));
// feature:new inserts imports above this line.

export const appRoutes: RouteObject[] = [
  { path: "/visualizations", element: <VisualizationsPage /> },
  { path: "/saved-analyses", element: <SavedAnalysesPage /> },
  { path: "/saved-analyses/example", element: <ExamplePage /> },
  { path: "/", element: <Navigate to="/consent-overview" replace /> },
  { path: "/consent-overview", element: <ConsentOverviewPage /> },
  { path: "/alliance-contribution", element: <AllianceContributionPage /> },
  { path: "/missings", element: <MissingsPage /> },
  // feature:new inserts routes above this line.
  { path: "*", element: <p>Cette page n’existe pas.</p> },
];
