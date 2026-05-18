import type { ReactNode } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

export function StatePanel({
  action,
  description,
  icon,
  minHeight = 180,
  title,
}: {
  action?: {
    href?: string;
    label: string;
  };
  description?: ReactNode;
  icon?: ReactNode;
  minHeight?: number;
  title: string;
}) {
  return (
    <Card component="section" variant="outlined">
      <CardContent
        sx={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          minHeight,
          p: 2,
          textAlign: "center",
        }}
      >
        <Stack spacing={1.15} sx={{ alignItems: "center", maxWidth: 560 }}>
          {icon ? (
            <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
          ) : null}
          <Typography sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.15 }}>
            {title}
          </Typography>
          {description ? (
            <Typography color="text.secondary" sx={{ lineHeight: 1.55 }}>
              {description}
            </Typography>
          ) : null}
          {action ? (
            <Button href={action.href} sx={{ mt: 0.5 }} variant="outlined">
              {action.label}
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
