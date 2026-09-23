import { parseGenieMessageRequest } from "@/features/genie/server/request";
import { createGenieMessageResponse } from "@/features/genie/server/runtime";
import { withApiRoute } from "@/lib/http/with-api-route";

type RouteContext = {
  params: Promise<{ alias: string }>;
};

export const POST = withApiRoute(async (request, context, routeContext: RouteContext) => {
  const [{ alias }, body] = await Promise.all([
    routeContext.params,
    parseGenieMessageRequest(request),
  ]);
  return createGenieMessageResponse(request, alias, body, context.requestId, context.log);
});
