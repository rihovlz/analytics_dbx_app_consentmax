import { getConsentOverview } from "@/features/consent-overview/server/service";
import { withApiRoute } from "@/lib/http/with-api-route";

export const GET = withApiRoute((_request, context) => getConsentOverview(context.requestId));
