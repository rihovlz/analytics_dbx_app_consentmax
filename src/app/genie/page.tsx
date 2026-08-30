import { GenieDemo } from "@/app/genie/genie-demo";
import { parseAppDisplayConfig } from "@/lib/config/server-config";

export const dynamic = "force-dynamic";

export default function GeniePage() {
  const config = parseAppDisplayConfig();
  return <GenieDemo alias="fraim-sales" mode={config.mode} />;
}
