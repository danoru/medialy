import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline } from "@mui/material";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
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

export const metadata: Metadata = {
  title: {
    default: "Medialy",
    template: "%s | Medialy",
  },
  description: "A local-first personal media recommendation dashboard.",
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
        <InitColorSchemeScript
          attribute="data-mui-color-scheme"
          defaultMode={initialThemeMode}
        />
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
