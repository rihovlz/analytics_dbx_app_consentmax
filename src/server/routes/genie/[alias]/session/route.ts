import { getGenieSession } from "@/features/genie/server/session";
import { withApiRoute } from "@/lib/http/with-api-route";

type RouteContext = { params: Promise<{ alias: string }> };
const session = withApiRoute(async (request, _context, route: RouteContext) =>
  getGenieSession(request, (await route.params).alias));

export async function GET(request: Request, route: RouteContext): Promise<Response> {
  const response = await session(request, route);
  response.headers.set("cache-control", "private, no-store");
  return response;
}
