export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-canvas/60 p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
    </div>
  );
}
