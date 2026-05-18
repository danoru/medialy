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
      <Typography component="h1" sx={{ fontWeight: 900 }} variant="h4">
        {title}
      </Typography>
      <Card aria-label={title} variant="outlined">
        <CardContent>
          <Typography color="text.secondary" sx={{ mb: 2 }} variant="body1">
            {description}
          </Typography>
          <Typography color="text.secondary">
            This area is scaffolded for the MVP workflow and ready for
            implementation.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
