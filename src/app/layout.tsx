import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/outfit";

import { AppShell } from "@/components/app-shell/app-shell";
import { parseAppDisplayConfig } from "@/lib/config/server-config";

import "./globals.css";

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
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
