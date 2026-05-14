import {
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
import { prisma } from "@/lib/prisma";
import { confidenceFromComparisons } from "@/lib/scoring";
import { formatMediaType } from "@/lib/format";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TopListsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const [overall, byType, genres] = await Promise.all([
    prisma.mediaItem.findMany({
      where: {
        isArchived: false,
        mediaType: selectedType,
        status: "COMPLETED",
      },
      orderBy: [{ computedPersonalScore: "desc" }, { pairwiseScore: "desc" }],
      take: 10,
    }),
    prisma.mediaItem.groupBy({
      by: ["mediaType"],
      where: { isArchived: false, mediaType: { in: [...VISIBLE_MEDIA_TYPES] } },
      _count: true,
    }),
    prisma.genre.findMany({
      include: { media: { include: { media: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const confidenceAdjusted = [...overall].sort(
    (a, b) =>
      (b.computedPersonalScore ?? b.pairwiseScore / 100) *
        confidenceFromComparisons(b.comparisonCount) -
      (a.computedPersonalScore ?? a.pairwiseScore / 100) *
        confidenceFromComparisons(a.comparisonCount),
  );

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            sx={{ mb: 2 }}
            value={selectedType}
            variant="scrollable"
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={`/top-lists?type=${type}`}
                key={type}
                label={formatMediaType(type)}
                value={type}
              />
            ))}
          </Tabs>
          <Divider />
        </CardContent>
      </Card>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ListCard title="Overall Completed">
            {overall.map((item, index) => (
              <RankRow
                key={item.id}
                href={`/media/${item.id}`}
                index={index}
                label={item.title}
                value={formatScore(
                  item.computedPersonalScore ?? item.pairwiseScore / 100,
                )}
              />
            ))}
          </ListCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ListCard title="Confidence Adjusted">
            {confidenceAdjusted.map((item, index) => (
              <RankRow
                key={item.id}
                href={`/media/${item.id}`}
                index={index}
                label={item.title}
                value={formatScore(
                  (item.computedPersonalScore ?? item.pairwiseScore / 100) *
                    confidenceFromComparisons(item.comparisonCount),
                )}
              />
            ))}
          </ListCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ListCard title="Media Type Mix">
            {byType.map((entry, index) => (
              <RankRow
                key={entry.mediaType}
                index={index}
                label={formatMediaType(entry.mediaType)}
                value={String(entry._count)}
              />
            ))}
          </ListCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ListCard title="Best Genres">
            {genres
              .map((genre) => {
                const completed = genre.media
                  .map((entry) => entry.media)
                  .filter(
                    (item) =>
                      item.status === "COMPLETED" &&
                      !item.isArchived &&
                      item.mediaType === selectedType,
                  );
                const average = completed.length
                  ? completed.reduce(
                      (sum, item) =>
                        sum +
                        (item.computedPersonalScore ??
                          item.pairwiseScore / 100),
                      0,
                    ) / completed.length
                  : 0;
                return { name: genre.name, count: completed.length, average };
              })
              .filter((entry) => entry.count > 0)
              .sort((a, b) => b.average - a.average)
              .slice(0, 10)
              .map((entry, index) => (
                <RankRow
                  key={entry.name}
                  index={index}
                  label={entry.name}
                  value={formatScore(entry.average)}
                />
              ))}
          </ListCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

function ListCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
          {title}
        </Typography>
        <Stack spacing={1.25}>{children}</Stack>
      </CardContent>
    </Card>
  );
}

function RankRow({
  href,
  index,
  label,
  value,
}: {
  href?: string;
  index: number;
  label: string;
  value: string;
}) {
  const text = href ? (
    <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>
      {label}
    </Link>
  ) : (
    label
  );
  return (
    <Stack
      direction="row"
      sx={{ alignItems: "center", justifyContent: "space-between" }}
    >
      <Typography>
        {index + 1}. {text}
      </Typography>
      <Chip label={value} size="small" />
    </Stack>
  );
}

function formatScore(value: number) {
  return value.toFixed(1);
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
