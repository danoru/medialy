import Link from "next/link";
import {
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/user";
import { visibleMediaTypeFilter } from "@/lib/media-types";
import { recommendForGuest } from "@/lib/social/guest-recommend";
import { CinematicCard } from "@/components/cinematic/CinematicPrimitives";
import { StatePanel } from "@/components/shared/StatePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recommend to a guest" };

const MAX_SEEDS = 8;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function GuestRecommendPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const viewerId = await requireUserId("/friends/guest");
  const params = await searchParams;
  const seedIds = asArray(params.seed).slice(0, MAX_SEEDS);

  // Catalog of pickable seeds: any visible-type item with a public-ish anchor
  // (a title — sufficient for the picker). Capped to a reasonable browse pool.
  const catalog = await prisma.mediaItem.findMany({
    where: { mediaType: visibleMediaTypeFilter() },
    select: { id: true, title: true, mediaType: true, posterUrl: true },
    orderBy: { title: "asc" },
    take: 250,
  });

  const recommendations = seedIds.length
    ? await recommendForGuest({ viewerId, seedMediaIds: seedIds, limit: 12 })
    : [];

  const seededSet = new Set(seedIds);
  const seededTitles = catalog
    .filter((item) => seededSet.has(item.id))
    .map((item) => item.title);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography sx={{ fontWeight: 700 }} variant="h4">
          Recommend something to a guest
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720 }} variant="body2">
          Pick a few titles your friend already loves. We&apos;ll cross them with your
          taste graph (and theirs, if they&apos;re on Medialy and you follow them) and
          surface what to watch, play, or read together. Nothing is saved — this
          is a one-shot recommendation.
        </Typography>
      </Box>

      <form>
        <CinematicCard>
          <Box sx={{ p: 2.5 }}>
            <Typography sx={{ fontWeight: 700, mb: 1.5 }} variant="h6">
              What does your guest like? ({seedIds.length}/{MAX_SEEDS})
            </Typography>

            {seededTitles.length > 0 ? (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
                {seededTitles.map((title) => (
                  <Chip key={title} label={title} size="small" />
                ))}
              </Stack>
            ) : null}

            <Grid container spacing={1}>
              {catalog.map((item) => {
                const checked = seededSet.has(item.id);
                return (
                  <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
                      <input
                        defaultChecked={checked}
                        disabled={!checked && seedIds.length >= MAX_SEEDS}
                        name="seed"
                        type="checkbox"
                        value={item.id}
                      />
                      <Typography sx={{ fontSize: "0.875rem" }}>
                        {item.title}
                      </Typography>
                    </label>
                  </Grid>
                );
              })}
            </Grid>

            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Button type="submit" variant="contained">
                Get recommendation
              </Button>
              <Link href="/friends/guest" style={{ textDecoration: "none" }}>
                <Button component="span" variant="text">
                  Reset
                </Button>
              </Link>
            </Stack>
          </Box>
        </CinematicCard>
      </form>

      <Box>
        <Typography sx={{ fontWeight: 700, mb: 1.5 }} variant="h6">
          What to share
        </Typography>
        {seedIds.length === 0 ? (
          <StatePanel
            description="Pick at least one title your guest likes to generate a recommendation."
            minHeight={140}
            title="Waiting for seeds"
          />
        ) : recommendations.length === 0 ? (
          <StatePanel
            description="We couldn't find a confident overlap. Try adding a few more titles."
            minHeight={140}
            title="No strong matches"
          />
        ) : (
          <Grid container spacing={1.5}>
            {recommendations.map((rec) => (
              <Grid key={rec.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <CinematicCard>
                  <Box sx={{ p: 1.5 }}>
                    {rec.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={rec.title}
                        src={rec.posterUrl}
                        style={{
                          aspectRatio: "2/3",
                          borderRadius: 6,
                          objectFit: "cover",
                          width: "100%",
                        }}
                      />
                    ) : null}
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", justifyContent: "space-between", mt: 1 }}
                    >
                      <Link
                        href={`/media/${rec.id}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        <Typography component="span" sx={{ fontWeight: 600 }}>
                          {rec.title}
                        </Typography>
                      </Link>
                      <Chip
                        color={rec.score >= 70 ? "success" : "default"}
                        label={`${rec.score}`}
                        size="small"
                      />
                    </Stack>
                    <Typography color="text.secondary" sx={{ fontSize: "0.875rem", mt: 0.5 }}>
                      {rec.reason}
                    </Typography>
                  </Box>
                </CinematicCard>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Stack>
  );
}
