"use client";

export function ErrorState({
  title,
  message,
  requestId,
  onRetry,
}: {
  title: string;
  message: string;
  requestId?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-950">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6">{message}</p>
      {requestId ? <p className="mt-2 text-xs text-red-800">Référence : {requestId}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
        >
          Réessayer
        </button>
      ) : null}
    </div>
  );
}
