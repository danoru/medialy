import { redirect } from "next/navigation";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { signIn } from "@/lib/auth";
import { getCurrentUser } from "@/lib/user";

/**
 * Sign-in page. Single Google button — Medialy is intentionally
 * Google-OAuth-only for now.
 *
 * The form posts to a server action that calls `signIn("google", ...)` so we
 * can route both the redirect and the `callbackUrl` query param without
 * shipping a client component.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // getCurrentUser (not auth() directly) so a valid-but-orphaned JWT — a token
  // whose user row is gone — is treated as signed-out and kept on this page,
  // the guard the auth session callback used to provide.
  const user = await getCurrentUser();
  const { callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallbackUrl);

  if (user) {
    redirect(callbackUrl);
  }

  return (
    <Container maxWidth="xs" sx={{ py: 12 }}>
      <Stack spacing={4} sx={{ alignItems: "center", textAlign: "center" }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Medialy
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in to access your library, ratings, and recommendations.
          </Typography>
        </Box>
        <form
          action={async () => {
            "use server";
            await signIn("google", {
              redirectTo: callbackUrl,
            });
          }}
        >
          <Button type="submit" variant="contained" size="large" fullWidth>
            Continue with Google
          </Button>
        </form>

        {process.env.NODE_ENV !== "production" ? (
          <form
            action={async () => {
              "use server";
              await signIn("dev-login", { redirectTo: callbackUrl });
            }}
          >
            <Button type="submit" variant="outlined" size="small" fullWidth>
              Dev sign-in (local only)
            </Button>
          </form>
        ) : null}
      </Stack>
    </Container>
  );
}

function safeCallbackUrl(value: string | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}
