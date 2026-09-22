import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/outfit";

import { AppShell } from "@/components/app-shell/app-shell";
import { userStateEnabled } from "@/features/user-state/server/config";
import { parseAppDisplayConfig } from "@/lib/config/server-config";

import "./globals.css";

// Optional capabilities are enabled by app.yaml at runtime, after CI builds.
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const config = parseAppDisplayConfig();
  return {
    title: config.appName,
    description: config.appDescription,
    icons: { icon: "/favicon.svg" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const config = parseAppDisplayConfig();
  const themeScript = `try{var t=localStorage.getItem("analytics-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}`;

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell
          appName={config.appName}
          appDescription={config.appDescription}
          supportName={config.supportContact.name}
          supportSlackUrl={config.supportContact.slackUrl}
          personalStateEnabled={userStateEnabled()}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
