import { ExampleAnalysis } from "@/features/user-state/example-analysis";
import { userStateEnabled } from "@/features/user-state/server/config";

export const dynamic = "force-dynamic";

export default function ExamplePage() {
  if (!userStateEnabled()) return <p>Les analyses personnelles ne sont pas activées dans cette application.</p>;
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Exemple d’analyse</h1><ExampleAnalysis /></div>;
}
