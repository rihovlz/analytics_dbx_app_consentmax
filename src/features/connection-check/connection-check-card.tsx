"use client";

import { useState } from "react";

import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { connectionCheckSchema, type ConnectionCheck } from "@/features/connection-check/contract";

type ViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: ConnectionCheck }
  | { status: "error"; message: string; requestId?: string };

export function ConnectionCheckCard({ initialMode }: { initialMode: "demo" | "databricks" }) {
  const [state, setState] = useState<ViewState>({ status: "idle" });

  async function runCheck(): Promise<void> {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/connection-check", { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const error = payload as { error?: { message?: string; requestId?: string } };
        setState({
          status: "error",
          message: error.error?.message ?? "La vérification a échoué.",
          requestId: error.error?.requestId,
        });
        return;
      }
      setState({ status: "success", result: connectionCheckSchema.parse(payload) });
    } catch {
      setState({ status: "error", message: "La réponse du serveur n’est pas valide." });
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-panel sm:p-8" aria-labelledby="connection-title">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-accent">Mode {initialMode}</p>
          <h2 id="connection-title" className="mt-1 text-xl font-semibold">Connexion Databricks</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Le test exécute une requête nommée et isolée dans la couche serveur. Aucun credential n’est transmis au navigateur.
          </p>
        </div>
        <button
          type="button"
          disabled={state.status === "loading"}
          onClick={runCheck}
          className="shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          Vérifier la connexion
        </button>
      </div>

      <div className="mt-6">
        {state.status === "idle" ? (
          <EmptyState title="Aucun test exécuté" message="Lancez le test pour valider le chemin UI → service → Databricks SQL." />
        ) : null}
        {state.status === "loading" ? <LoadingState label="Vérification en cours…" /> : null}
        {state.status === "error" ? (
          <ErrorState title="Connexion non vérifiée" message={state.message} requestId={state.requestId} onRetry={runCheck} />
        ) : null}
        {state.status === "success" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <p className="font-semibold">
              {state.result.status === "demo" ? "Mode démo opérationnel" : "Connexion Databricks opérationnelle"}
            </p>
            <p className="mt-2 text-sm">
              {state.result.currentUser ? `Utilisateur SQL : ${state.result.currentUser}` : "Aucun appel Databricks en mode démo."}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
