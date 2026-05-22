import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { getDataHealthReport } from "@/lib/insights";
import { formatMediaType } from "@/lib/format";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import {
  mediaTypeTabIndicatorColor,
  mediaTypeTabSx,
} from "@/lib/media-ui-helpers";
import { StatePanel } from "@/components/shared/StatePanel";
import { requireUserId } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data Health" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DataHealthPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const userId = await requireUserId("/data-health");
  const params = await searchParams;
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const report = await getDataHealthReport(userId);
  const filteredReport = {
    missingGenres: report.missingGenres.filter(
      (item) => item.mediaType === selectedType,
    ),
    missingDates: report.missingDates.filter(
      (item) => item.mediaType === selectedType,
    ),
    missingPosters: report.missingPosters.filter(
      (item) => item.mediaType === selectedType,
    ),
    lowComparisonItems: report.lowComparisonItems.filter(
      (item) => item.mediaType === selectedType,
    ),
    duplicateCandidates: report.duplicateCandidates.filter((group) =>
      group.items.some((item) => item.mediaType === selectedType),
    ),
  };

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            sx={{ mb: 2 }}
            slotProps={{
              indicator: {
                sx: { backgroundColor: mediaTypeTabIndicatorColor(selectedType) },
              },
            }}
            value={selectedType}
            variant="scrollable"
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={`/data-health?type=${type}`}
                key={type}
                label={formatMediaType(type)}
                sx={mediaTypeTabSx(type)}
                value={type}
              />
            ))}
          </Tabs>
          <Divider />
        </CardContent>
      </Card>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <HealthCard
            items={filteredReport.missingGenres}
            title="Missing Genres"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <HealthCard
            items={filteredReport.missingDates}
            title="Missing Dates"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <HealthCard
            items={filteredReport.missingPosters}
            title="Missing Posters"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <HealthCard
            items={filteredReport.lowComparisonItems}
            title="Low Comparisons"
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", mb: 2 }}
              >
                <Typography sx={{ fontWeight: 700 }} variant="h6">
                  Duplicate Candidates
                </Typography>
                <Chip label={filteredReport.duplicateCandidates.length} />
              </Stack>
              <Stack spacing={1}>
                {filteredReport.duplicateCandidates.map((group) => (
                  <Box key={group.key}>
                    <Typography color="text.secondary" variant="body2">
                      {formatDuplicateKey(group.key)}
                    </Typography>
                    <Stack
                      direction="row"
                      sx={{ flexWrap: "wrap", gap: 1, mt: 0.75 }}
                    >
                      {group.items
                        .filter((item) => item.mediaType === selectedType)
                        .map((item) => (
                          <Link
                            href={`/media/${item.id}`}
                            key={item.id}
                            style={{ textDecoration: "none" }}
                          >
                            <Chip label={item.title} variant="outlined" />
                          </Link>
                        ))}
                    </Stack>
                  </Box>
                ))}
                {filteredReport.duplicateCandidates.length === 0 ? (
                  <StatePanel
                    description="No same-title and same-year candidates were found for the selected media type."
                    minHeight={160}
                    title="No duplicate candidates found"
                  />
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}

function formatDuplicateKey(key: string) {
  const [title, mediaType, year] = key.split("::");
  const displayTitle = title
    ? title.charAt(0).toUpperCase() + title.slice(1)
    : "Untitled";
  return `${displayTitle} - ${formatMediaType(mediaType ?? "UNKNOWN")} - ${year ?? "unknown year"}`;
}

function HealthCard({
  items,
  title,
}: {
  items: Array<{ id: string; title: string }>;
  title: string;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: "space-between", mb: 2 }}>
          <Typography sx={{ fontWeight: 700 }} variant="h6">
            {title}
          </Typography>
          <Chip
            color={items.length ? "warning" : "success"}
            label={items.length}
          />
        </Stack>
        <Stack spacing={1}>
          {items.slice(0, 12).map((item) => (
            <Link
              href={`/media/${item.id}`}
              key={item.id}
              style={{ textDecoration: "none" }}
            >
              <Typography sx={{ color: "primary.main" }}>
                {item.title}
              </Typography>
            </Link>
          ))}
          {items.length === 0 ? (
            <StatePanel
              description="Everything in this category looks complete for the current media type."
              minHeight={140}
              title="No issues"
            />
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
