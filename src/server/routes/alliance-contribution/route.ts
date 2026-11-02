import { getAllianceContribution } from "@/features/alliance-contribution/server/service";
import { withApiRoute } from "@/lib/http/with-api-route";

export const GET = withApiRoute((_request, context) => getAllianceContribution(context.requestId));
