import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileNav } from "@/components/mobile-nav";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-brand">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nuvia Toon — Read Magical Manhwa & Novels" },
      {
        name: "description",
        content:
          "Discover trending manhwa and novels with a magical reading experience. Unlock premium chapters with coins.",
      },
      { property: "og:title", content: "Nuvia Toon — Read Magical Manhwa & Novels" },
      {
        property: "og:description",
        content:
          "Discover trending manhwa and novels with a magical reading experience. Unlock premium chapters with coins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Nuvia Toon — Read Magical Manhwa & Novels" },
      {
        name: "twitter:description",
        content:
          "Discover trending manhwa and novels with a magical reading experience. Unlock premium chapters with coins.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7974b71b-459b-4dc0-a570-816398753b1a/id-preview-11016cb7--c3549c37-0486-480d-915f-00213b732564.lovable.app-1777596935154.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7974b71b-459b-4dc0-a570-816398753b1a/id-preview-11016cb7--c3549c37-0486-480d-915f-00213b732564.lovable.app-1777596935154.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-magic">
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
  const location = useLocation();
  const isReader = /\/series\/[^/]+\/chapter\//.test(location.pathname);

  return (
    <ThemeProvider>
      <AuthProvider>
        {!isReader && <SiteHeader />}
        <main className={isReader ? "" : "pt-0 pb-20 md:pb-0"}>
          <Outlet />
        </main>
        {!isReader && <SiteFooter />}
        {!isReader && <MobileNav />}
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </ThemeProvider>
  );
}
