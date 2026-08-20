const links = [{ href: "/", label: "Accueil" }];

export function AppNav() {
  return (
    <nav aria-label="Navigation principale" className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl gap-2 px-4 sm:px-6 lg:px-8">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-current="page"
            className="border-b-2 border-accent px-3 py-3 text-sm font-medium text-ink"
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
