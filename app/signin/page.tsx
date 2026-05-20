import { redirect } from "next/navigation";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { auth, signIn } from "@/lib/auth";

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
  const session = await auth();
  const { callbackUrl } = await searchParams;

  if (session?.user) {
    redirect(callbackUrl ?? "/");
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
              redirectTo: callbackUrl ?? "/",
            });
          }}
        >
          <Button type="submit" variant="contained" size="large" fullWidth>
            Continue with Google
          </Button>
        </form>
      </Stack>
    </Container>
  );
}
