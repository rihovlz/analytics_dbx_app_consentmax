import type { ReactNode } from "react";

import { AppHeader } from "@/components/app-shell/app-header";
import { AppNav } from "@/components/app-shell/app-nav";

export function AppShell({
  appName,
  appDescription,
  children,
}: {
  appName: string;
  appDescription: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <AppHeader appName={appName} appDescription={appDescription} />
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
