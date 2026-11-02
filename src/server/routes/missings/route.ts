import { getMissings } from "@/features/missings/server/service";
import { withApiRoute } from "@/lib/http/with-api-route";

export const GET = withApiRoute((_request, context) => getMissings(context.requestId));
