import { userStateRoutes } from "@/features/user-state/server/route";
import { userStateRuntime } from "@/features/user-state/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const routes = userStateRoutes(userStateRuntime);
export const GET = routes.get;
export const PUT = routes.put;
export const DELETE = routes.remove;
