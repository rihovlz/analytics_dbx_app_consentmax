import { europeFeatures } from "./demo-map-data";
import { VisualizationsDemo } from "./visualizations-demo";

export default function VisualizationsPage() {
  return <VisualizationsDemo europeFeatures={europeFeatures} />;
}
