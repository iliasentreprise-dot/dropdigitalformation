import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, THEME_PRE_PAINT_SCRIPT } from "@/lib/theme-context";
import { GlobalProgressBar } from "@/components/dd/GlobalProgressBar";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
      { title: "DropDigital — Système Pirate" },
      { name: "description", content: "Formation DropDigital — Vendre des produits digitaux sur TikTok en automatique, sans visage, sans audience, sans montage." },
      { name: "author", content: "DropDigital" },
      { property: "og:title", content: "DropDigital — Système Pirate" },
      { property: "og:description", content: "Formation DropDigital — Vendre des produits digitaux sur TikTok en automatique, sans visage, sans audience, sans montage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@DropDigital" },
      { name: "twitter:title", content: "DropDigital — Système Pirate" },
      { name: "twitter:description", content: "Formation DropDigital — Vendre des produits digitaux sur TikTok en automatique, sans visage, sans audience, sans montage." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e93ff7d4-5342-4ae2-8c46-f037a07ff1b9/id-preview-f439a8b5--3d165468-7237-4d94-b2cd-a3c57d11aee2.lovable.app-1776480600180.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e93ff7d4-5342-4ae2-8c46-f037a07ff1b9/id-preview-f439a8b5--3d165468-7237-4d94-b2cd-a3c57d11aee2.lovable.app-1776480600180.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      { children: THEME_PRE_PAINT_SCRIPT },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
  return (
    <ThemeProvider>
      <AuthProvider>
        <GlobalProgressBar />
        <Outlet />
      </AuthProvider>
    </ThemeProvider>
  );
}
