import { AFFINITY_TUNING } from "@/lib/scoring/config";
import {
  saturate,
  shrunkContribution,
  type RatingAccumulator,
} from "@/lib/scoring/affinity";
import { GENRE_WEIGHT, TAG_WEIGHT } from "@/lib/scoring/taxonomySimilarity";

/**
 * The v1 taste profile, kept pure so it can run offline in the holdout and
 * be compared against the v2 engine. `lib/recommendations.ts` loads the rows
 * and hands them here.
 */

export type ContributorAffinity = {
  weight: number;
  name: string;
  role: string;
  exampleCount: number;
  topExample: { title: string; rating: number };
};

export type CountryAffinity = {
  exampleCount: number;
};

export type AffinityMaps = {
  genres: Map<string, number>;
  tags: Map<string, number>;
  contributors: Map<string, ContributorAffinity>;
  countries: Map<string, CountryAffinity>;
};

export type AffinityRow = {
  rating: number;
  media: {
    title: string;
    genres: Array<{ genre: { name: string } }>;
    tags: Array<{
      tag: { name: string; category?: string | null; countryCode?: string | null };
    }>;
    credits: Array<{ role: string; contributor: { id: string; name: string } }>;
  };
};

// Directors and creators carry a strong authorial fingerprint; publishers/devs
// are more incidental, so we give them less weight per match. Applied as a
// post-shrinkage multiplier so it doesn't distort the per-contributor mean rating.
export const ROLE_WEIGHT: Record<string, number> = {
  DIRECTOR: 1,
  CREATOR: 1,
  DEVELOPER: 0.55,
  PUBLISHER: 0.35,
  // Actor data is brand-new; suppress its scoring contribution until we have
  // enough rated items to validate the signal isn't just popularity noise.
  ACTOR: 0,
};

// Excluded from country affinity: most users have a US-heavy library by
// default, so matching on US would add noise without signal.
export const COUNTRY_AFFINITY_EXCLUSIONS = new Set(["US"]);

// Tag and contributor buckets are post-multiplied to keep their typical
// contributions in roughly the same ratio they had under the old itemBoost
// scheme — tags supplement genres, contributors land between the two.
const TAG_BUCKET_SCALE = TAG_WEIGHT / GENRE_WEIGHT;
const CONTRIBUTOR_BUCKET_SCALE = 0.6;

/** v1 only learns from titles the viewer scored at least this highly. */
export const V1_LOVED_THRESHOLD = 8;

function pushRating(acc: Map<string, RatingAccumulator>, key: string, rating: number) {
  const existing = acc.get(key);
  if (existing) {
    existing.sum += rating;
    existing.count += 1;
  } else {
    acc.set(key, { sum: rating, count: 1 });
  }
}

/** Builds the v1 affinity maps from the viewer's loved, completed titles. */
export function buildAffinityMaps(rows: AffinityRow[]): AffinityMaps {
  const genreRatings = new Map<string, RatingAccumulator>();
  const tagRatings = new Map<string, RatingAccumulator>();
  type ContributorAccum = RatingAccumulator & {
    name: string;
    role: string;
    topExample: { title: string; rating: number };
  };
  const contributorRatings = new Map<string, ContributorAccum>();
  const countries = new Map<string, CountryAffinity>();

  let poolSum = 0;
  let poolCount = 0;

  for (const row of rows) {
    const rating = row.rating;
    if (rating <= 0) continue;
    poolSum += rating;
    poolCount += 1;
    const itemRating = Math.round(rating);

    for (const entry of row.media.genres) {
      pushRating(genreRatings, entry.genre.name, rating);
    }
    for (const entry of row.media.tags) {
      pushRating(tagRatings, entry.tag.name, rating);

      if (
        entry.tag.category === "COUNTRY" &&
        entry.tag.countryCode &&
        !COUNTRY_AFFINITY_EXCLUSIONS.has(entry.tag.countryCode)
      ) {
        const existing = countries.get(entry.tag.countryCode);
        countries.set(entry.tag.countryCode, {
          exampleCount: (existing?.exampleCount ?? 0) + 1,
        });
      }
    }
    for (const entry of row.media.credits) {
      const id = entry.contributor.id;
      const existing = contributorRatings.get(id);
      if (existing) {
        existing.sum += rating;
        existing.count += 1;
        if (itemRating > existing.topExample.rating) {
          existing.topExample = { title: row.media.title, rating: itemRating };
        }
      } else {
        contributorRatings.set(id, {
          sum: rating,
          count: 1,
          name: entry.contributor.name,
          role: entry.role,
          topExample: { title: row.media.title, rating: itemRating },
        });
      }
    }
  }

  const globalMean = poolCount > 0 ? poolSum / poolCount : AFFINITY_TUNING.neutralPivot;

  const genres = new Map<string, number>();
  for (const [name, acc] of genreRatings) {
    genres.set(name, shrunkContribution(acc, globalMean));
  }
  const tags = new Map<string, number>();
  for (const [name, acc] of tagRatings) {
    tags.set(name, shrunkContribution(acc, globalMean) * TAG_BUCKET_SCALE);
  }
  const contributors = new Map<string, ContributorAffinity>();
  for (const [id, acc] of contributorRatings) {
    const roleMultiplier = ROLE_WEIGHT[acc.role] ?? 0.5;
    const weight =
      shrunkContribution(acc, globalMean) *
      CONTRIBUTOR_BUCKET_SCALE *
      roleMultiplier;
    contributors.set(id, {
      weight,
      name: acc.name,
      role: acc.role,
      exampleCount: acc.count,
      topExample: acc.topExample,
    });
  }

  return { genres, tags, contributors, countries };
}

/** The three saturated 0–100 affinity inputs to Medialy Match for one candidate. */
export function candidateAffinity(
  item: {
    genres: Array<{ genre: { name: string } }>;
    tags: Array<{ tag: { name: string } }>;
    credits: Array<{ contributor: { id: string } }>;
  },
  affinity: AffinityMaps,
) {
  const genreRaw = item.genres.reduce(
    (total, entry) => total + (affinity.genres.get(entry.genre.name) ?? 0),
    0,
  );
  const tagRaw = item.tags.reduce(
    (total, entry) => total + (affinity.tags.get(entry.tag.name) ?? 0),
    0,
  );
  const contributorRaw = item.credits.reduce(
    (total, entry) =>
      total + (affinity.contributors.get(entry.contributor.id)?.weight ?? 0),
    0,
  );
  return {
    genreAffinity: saturate(genreRaw, AFFINITY_TUNING.saturationK.genre),
    tagAffinity: saturate(tagRaw, AFFINITY_TUNING.saturationK.tag),
    contributorAffinity: saturate(
      contributorRaw,
      AFFINITY_TUNING.saturationK.contributor,
    ),
  };
}
