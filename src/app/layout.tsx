import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { getServerConfig } from "@/lib/config/server-config";

import "./globals.css";

export const metadata: Metadata = {
  title: "Databricks App",
  description: "A reusable Databricks App",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const config = getServerConfig();

  return (
    <html lang="fr">
      <body>
        <AppShell appName={config.appName} appDescription={config.appDescription}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
