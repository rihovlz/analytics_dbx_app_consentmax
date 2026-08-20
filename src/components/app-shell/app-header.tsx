export function AppHeader({ appName, appDescription }: { appName: string; appDescription: string }) {
  return (
    <header className="border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-white">
          <span className="text-sm font-bold">DB</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{appName}</p>
          <p className="truncate text-sm text-muted">{appDescription}</p>
        </div>
      </div>
    </header>
  );
}
