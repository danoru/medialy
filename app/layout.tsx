import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline } from "@mui/material";
import { AppShell } from "@/components/app-shell/AppShell";
import { Providers } from "@/components/Providers";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable}`}>
        <AppRouterCacheProvider>
          <Providers>
            <CssBaseline />
            <AppShell>{children}</AppShell>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
