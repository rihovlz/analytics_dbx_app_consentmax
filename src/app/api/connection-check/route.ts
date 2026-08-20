import { checkConnection } from "@/features/connection-check/server/service";
import { withApiRoute } from "@/lib/http/with-api-route";

export const dynamic = "force-dynamic";

export const GET = withApiRoute((_request, context) => checkConnection(context.requestId));
