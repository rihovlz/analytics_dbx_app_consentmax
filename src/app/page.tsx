import { ConnectionCheckCard } from "@/features/connection-check/connection-check-card";
import { getServerConfig } from "@/lib/config/server-config";

export default function HomePage() {
  const config = getServerConfig();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Golden path</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Un socle neutre pour votre prochaine Databricks App
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
          Ajoutez vos fonctionnalités dans <code>src/features</code>. La configuration, l’accès SQL,
          les erreurs et les logs restent isolés dans le socle technique.
        </p>
      </section>

      <ConnectionCheckCard initialMode={config.mode} />
    </div>
  );
}
