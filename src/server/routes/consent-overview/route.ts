import { filterParamsSchema } from "@/features/consent-overview/contract";
import { getConsentOverview } from "@/features/consent-overview/server/service";
import { withApiRoute } from "@/lib/http/with-api-route";

export const GET = withApiRoute((request, context) => {
  const q = request.query as Record<string, string>;
  const filters = filterParamsSchema.parse({
    member: q["member"] || undefined,
    startDate: q["startDate"] || undefined,
    endDate: q["endDate"] || undefined,
    granularity: q["granularity"] || undefined,
  });
  return getConsentOverview(filters, context.requestId);
});
