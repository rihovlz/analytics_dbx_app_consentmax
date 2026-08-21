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
    <div role="alert" className="rounded-xl border border-[#ffc5c5] bg-[#fff2f2] p-5 text-ink">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm font-light leading-6">{message}</p>
      {requestId ? <p className="mt-2 text-xs text-[#a42627]">Référence : {requestId}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-11 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#343636]"
        >
          Réessayer
        </button>
      ) : null}
    </div>
  );
}
