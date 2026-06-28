import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { Sidebar } from "@/components/shell/Sidebar";
import { RightPanel } from "@/components/shell/RightPanel";
import { useLuban } from "@/store/luban";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Luban — Agentic Marketing for Hilti" },
      { name: "description", content: "Conversational campaign agent with human approval gates and a compounding skills library." },
      { property: "og:title", content: "Luban — Agentic Marketing for Hilti" },
      { name: "twitter:title", content: "Luban — Agentic Marketing for Hilti" },
      { property: "og:description", content: "Conversational campaign agent with human approval gates and a compounding skills library." },
      { name: "twitter:description", content: "Conversational campaign agent with human approval gates and a compounding skills library." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c4a97b83-03cb-412c-aadd-7549df704892/id-preview-24328a9d--c1091e6c-b426-4c2c-b5ad-0ff8c2f1d969.lovable.app-1782651847678.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c4a97b83-03cb-412c-aadd-7549df704892/id-preview-24328a9d--c1091e6c-b426-4c2c-b5ad-0ff8c2f1d969.lovable.app-1782651847678.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="p-10 text-foreground">404 — not found</div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-10 text-foreground">
      <h1 className="text-xl font-semibold">Something broke</h1>
      <pre className="mt-4 text-xs text-muted-foreground">{String(error)}</pre>
    </div>
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const layout = useLuban((s) => s.layout);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <Sidebar />
        <main className="flex flex-1 min-w-0">
          {layout !== "panel" && (
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <Outlet />
            </div>
          )}
          {layout !== "chat" && (
            <div className="w-[400px] border-l border-border bg-card flex flex-col overflow-hidden">
              <RightPanel />
            </div>
          )}
        </main>
      </div>
      <Toaster position="bottom-right" theme="dark" />
    </QueryClientProvider>
  );
}
