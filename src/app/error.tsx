"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states/error-state";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Next.js forwards server-side details to structured logs; do not expose them here.
  }, [error]);

  return (
    <ErrorState
      title="L’application n’a pas pu s’afficher"
      message="Réessayez. Si le problème persiste, transmettez l’heure de l’erreur à l’équipe support."
      onRetry={reset}
    />
  );
}
