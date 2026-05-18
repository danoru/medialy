"use client";

import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import { Button, Stack, Typography } from "@mui/material";
import { useEffect } from "react";
import { StatePanel } from "@/components/shared/StatePanel";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Stack spacing={2}>
      <StatePanel
        description="Something went wrong while loading this screen. Your local data was not changed."
        icon={<ReportProblemIcon sx={{ fontSize: 42 }} />}
        minHeight={340}
        title="This page hit an error"
      />
      <Button onClick={reset} sx={{ alignSelf: "center" }} variant="outlined">
        Try again
      </Button>
      {error.digest ? (
        <Typography color="text.secondary" sx={{ textAlign: "center" }}>
          Error reference: {error.digest}
        </Typography>
      ) : null}
      <Button href="/dashboard" sx={{ alignSelf: "center" }} variant="text">
        Go to dashboard
      </Button>
    </Stack>
  );
}
