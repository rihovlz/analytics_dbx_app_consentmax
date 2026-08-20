import { withApiRoute } from "@/lib/http/with-api-route";

export const dynamic = "force-dynamic";

export const GET = withApiRoute(() => ({ status: "ok" as const }));
