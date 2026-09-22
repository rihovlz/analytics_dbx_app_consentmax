import { userStateRoutes } from "@/features/user-state/server/route";
import { userStateRuntime } from "@/features/user-state/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = userStateRoutes(userStateRuntime).list;
