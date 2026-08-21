export function buildSourceAccessQuery(sourceCount: number): string {
  if (!Number.isInteger(sourceCount) || sourceCount < 1 || sourceCount > 50) {
    throw new Error("Readiness requires between 1 and 50 declared sources");
  }
  return Array.from(
    { length: sourceCount },
    () => "SELECT 1 AS accessible FROM IDENTIFIER(?) WHERE FALSE",
  ).join(" UNION ALL ");
}
