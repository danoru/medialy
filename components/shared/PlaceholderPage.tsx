import { Card, CardContent, Stack, Typography } from "@mui/material";

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Stack spacing={3}>
      <div>
        <Typography component="h1" sx={{ fontWeight: 700 }} variant="h4">
          {title}
        </Typography>
        <Typography color="text.secondary" variant="body1">
          {description}
        </Typography>
      </div>
      <Card variant="outlined">
        <CardContent>
          <Typography color="text.secondary">
            This area is scaffolded for the MVP workflow and ready for
            implementation.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
