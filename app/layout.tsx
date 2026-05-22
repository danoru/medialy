import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline } from "@mui/material";
import { AppShell } from "@/components/app-shell/AppShell";
import { Providers } from "@/components/Providers";
import { getCurrentUser, userInitial } from "@/lib/user";
import type { ThemeMode } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

function absoluteSiteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3001";

  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;
}

const metadataBase = new URL(absoluteSiteUrl());
const ogImageUrl = new URL("/og-images/medialy-og-v2.png", metadataBase);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Medialy",
    template: "%s | Medialy",
  },
  description: "A local-first personal media recommendation dashboard.",
  openGraph: {
    title: "Medialy",
    description: "A local-first personal media recommendation dashboard.",
    siteName: "Medialy",
    type: "website",
    url: "/",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Medialy personal media recommendations dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Medialy",
    description: "A local-first personal media recommendation dashboard.",
    images: [ogImageUrl],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  // Light mode is disabled until every panel honors theme tokens — see commit
  // d338cd1 for the first partial pass. Until then, pin everything to dark
  // so hardcoded dark backgrounds don't collide with light-mode text colors.
  const initialThemeMode: ThemeMode = "dark";

  return (
    <html
      lang="en"
      data-theme={initialThemeMode}
      data-mui-color-scheme={initialThemeMode}
      suppressHydrationWarning
    >
      <body className={`${inter.variable} ${spaceGrotesk.variable}`}>
        <AppRouterCacheProvider>
          <Providers initialThemeMode={initialThemeMode}>
            <CssBaseline />
            <AppShell
              isAdmin={Boolean(user?.isAdmin)}
              isAuthenticated={Boolean(user)}
              userInitial={user ? userInitial(user.displayName) : null}
              userName={user?.displayName ?? null}
            >
              {children}
            </AppShell>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
