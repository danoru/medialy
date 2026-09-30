import { cache } from "react";
import type { ContributorKind, MediaType } from "@prisma/client";
import {
  getCatalogItems,
  getCatalogWithUser,
  type CatalogItem,
} from "@/lib/db/catalog";
import { prisma } from "@/lib/prisma";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import {
  buildPeopleIndex,
  collaborators,
  creditStatusLabel,
  isSeen,
  personalScore,
  personStats,
  primaryMediaType,
  recentPeople,
  rolesLabel,
  ROLE_GROUPS,
  searchPeople,
  topPeople,
  unfinishedBusiness,
  userMeans,
  personArt,
  type PeopleIndex,
  type PersonArt,
  type PersonCredit,
  type PersonEntry,
  type PeopleSourceRow,
} from "@/lib/people";
import { unexperiencedWord } from "@/lib/status-labels";
import { normalizeSearchText } from "@/lib/text-normalization";
import { getCurrentUserId } from "@/lib/user";

/**
 * The People pages' data. Everything is derived from the cached catalog plus
 * the viewer's own rows — the same pair of reads the dashboard makes — so a
 * person's page costs no extra database egress. Only trimmed, serialisable
 * DTOs leave this file; the catalog itself never reaches the client.
 */

export type PeopleTile = {
  id: string;
  title: string;
  mediaType: MediaType;
  posterUrl: string | null;
  releaseDate: string | null;
};

export type PersonSummary = {
  id: string;
  name: string;
  kind: ContributorKind;
  /** "Director · Actor", limited to the roles in view. */
  roles: string;
  titleCount: number;
  seenCount: number;
  ratedCount: number;
  average: number | null;
  delta: number | null;
  /** Credits per type, for the colour dots on search results. */
  types: Array<{ mediaType: MediaType; count: number }>;
  /** Titles to show beside the row — unseen ones in "Unfinished business". */
  tiles: PeopleTile[];
  /** The poster standing in for the person (see `personArt`). */
  art: PersonArt | null;
  /** A short qualifier: "from Heat", "3 together". */
  note: string | null;
};

export type PeopleHubSection = {
  mediaType: MediaType;
  mean: number | null;
  spotlight: {
    person: PersonSummary;
    group: string;
    feature: { tile: PeopleTile; score: number | null };
  } | null;
  groups: Array<{ key: string; label: string; people: PersonSummary[] }>;
  unfinished: PersonSummary[];
  recent: PersonSummary[];
};

export type PeopleHubData = {
  signedIn: boolean;
  query: string;
  results: PersonSummary[] | null;
  byType: PeopleHubSection[];
};

export type PersonTypeSection = {
  mediaType: MediaType;
  mean: number | null;
  roles: string;
  titleCount: number;
  seenCount: number;
  ratedCount: number;
  unseenCount: number;
  average: number | null;
  delta: number | null;
  feature: { tile: PeopleTile; score: number | null; yours: boolean } | null;
  rated: Array<{ tile: PeopleTile; score: number }>;
  unseen: Array<{ tile: PeopleTile; consensus: number | null; watchlisted: boolean }>;
  collaborators: PersonSummary[];
  credits: Array<{
    tile: PeopleTile;
    roles: string;
    score: number | null;
    status: string | null;
    seen: boolean;
  }>;
};

export type PersonPageData = {
  signedIn: boolean;
  person: { id: string; name: string; kind: ContributorKind; roles: string };
  defaultType: MediaType;
  byType: PersonTypeSection[];
};

function tile(row: PeopleSourceRow): PeopleTile {
  return {
    id: row.id,
    title: row.title,
    mediaType: row.mediaType,
    posterUrl: row.posterUrl,
    releaseDate: row.releaseDate?.toISOString() ?? null,
  };
}

function byRelease(a: PersonCredit, b: PersonCredit) {
  return (b.row.releaseDate?.getTime() ?? 0) - (a.row.releaseDate?.getTime() ?? 0);
}

function summarize(
  entry: PersonEntry,
  {
    mediaType,
    mean,
    roles,
    tiles = [],
    note = null,
    exclude = [],
  }: {
    mediaType?: MediaType;
    mean?: number | null;
    roles?: PersonCredit["roles"];
    tiles?: PeopleTile[];
    note?: string | null;
    /** Titles already beside the row, so the avatar doesn't repeat them. */
    exclude?: string[];
  } = {},
): PersonSummary {
  const credits = entry.credits.filter(
    (credit) =>
      (!mediaType || credit.row.mediaType === mediaType) &&
      (!roles || credit.roles.some((role) => roles.includes(role))),
  );
  const scores = credits
    .map((credit) => personalScore(credit.row))
    .filter((score): score is number => score != null);
  const average = scores.length
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : null;
  const types = new Map<MediaType, number>();
  for (const credit of credits) {
    types.set(credit.row.mediaType, (types.get(credit.row.mediaType) ?? 0) + 1);
  }
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    roles: rolesLabel(
      credits.flatMap((credit) =>
        roles ? credit.roles.filter((role) => roles.includes(role)) : credit.roles,
      ),
    ),
    titleCount: credits.length,
    seenCount: credits.filter((credit) => isSeen(credit.row)).length,
    ratedCount: scores.length,
    average,
    delta: average != null && mean != null ? average - mean : null,
    types: VISIBLE_MEDIA_TYPES.filter((type) => types.has(type)).map((type) => ({
      mediaType: type,
      count: types.get(type)!,
    })),
    tiles,
    note,
    art: personArt(
      credits.map((credit) => credit.row),
      new Set([...exclude, ...tiles.map((tile) => tile.id)]),
    ),
  };
}

const getPeopleContext = cache(async () => {
  const userId = await getCurrentUserId();
  const rows = (await getCatalogWithUser(userId)) as PeopleSourceRow[];
  return {
    signedIn: userId != null,
    rows,
    index: buildPeopleIndex(rows),
    means: userMeans(rows),
  };
});

function hubSection(
  index: PeopleIndex,
  rows: PeopleSourceRow[],
  mediaType: MediaType,
  mean: number | null,
): PeopleHubSection {
  const groups = ROLE_GROUPS[mediaType].map((group) => ({
    key: group.key,
    label: group.label,
    ranked: topPeople(index, mediaType, mean, group.roles),
    roles: group.roles,
  }));
  const lead = groups.find((group) => group.ranked.length);
  const spotlight = lead
    ? (() => {
        const { entry, stats } = lead.ranked[0];
        const best = stats.rated[0];
        return {
          person: summarize(entry, { mediaType, mean, roles: lead.roles }),
          group: lead.label,
          feature: { tile: tile(best.credit.row), score: best.score },
        };
      })()
    : null;
  return {
    mediaType,
    mean,
    spotlight,
    groups: groups.map((group) => ({
      key: group.key,
      label: group.label,
      people: group.ranked.map(({ entry }) =>
        summarize(entry, { mediaType, mean, roles: group.roles }),
      ),
    })),
    unfinished: unfinishedBusiness(index, mediaType, mean).map(({ entry, stats }) =>
      summarize(entry, {
        mediaType,
        mean,
        tiles: [...stats.unseen]
          .sort(
            (a, b) =>
              (b.row.computedConsensusScore ?? 0) - (a.row.computedConsensusScore ?? 0),
          )
          .slice(0, 4)
          .map((credit) => tile(credit.row)),
        note: `${stats.unseen.length} ${unexperiencedWord(mediaType)}`,
      }),
    ),
    recent: recentPeople(index, rows, mediaType).map(({ entry, from }) =>
      summarize(entry, {
        mediaType,
        mean,
        note: `from ${from.title}`,
        exclude: [from.id],
      }),
    ),
  };
}

export async function getPeopleHubData(query: string): Promise<PeopleHubData> {
  const { signedIn, rows, index, means } = await getPeopleContext();
  const trimmed = query.trim();
  return {
    signedIn,
    query: trimmed,
    results: trimmed
      ? searchPeople(index, trimmed).map(({ entry }) => summarize(entry))
      : null,
    byType: VISIBLE_MEDIA_TYPES.map((type) =>
      hubSection(index, rows, type, means.get(type) ?? null),
    ),
  };
}

/** Surnames shared by more people than this are shown, never merged into results. */
const MERGE_LIMIT = 3;

/**
 * Everyone credited in the cached catalog, with no viewer data. Library search
 * reads this rather than the People context so a search never pulls the
 * viewer's whole library. New titles' credits appear once the catalog cache
 * refreshes (up to its revalidate window).
 */
const getCatalogPeople = cache(async () => {
  const people = new Map<
    string,
    {
      id: string;
      name: string;
      kind: ContributorKind;
      normalized: string;
      roles: Set<PersonCredit["roles"][number]>;
      mediaIds: Set<string>;
      types: Map<MediaType, number>;
      art: { posterUrl: string; title: string; score: number } | null;
    }
  >();
  for (const item of await getCatalogItems()) {
    const counted = new Set<string>();
    for (const { contributor, role } of item.credits) {
      let person = people.get(contributor.id);
      if (!person) {
        person = {
          id: contributor.id,
          name: contributor.name,
          kind: contributor.kind,
          normalized: normalizeSearchText(contributor.name),
          roles: new Set(),
          mediaIds: new Set(),
          types: new Map(),
          art: null as { posterUrl: string; title: string; score: number } | null,
        };
        people.set(contributor.id, person);
      }
      person.roles.add(role);
      person.mediaIds.add(item.id);
      // No viewer here: the best-reviewed title with a poster pictures them.
      if (item.posterUrl) {
        const score = item.computedConsensusScore ?? -1;
        if (!person.art || score > person.art.score) {
          person.art = { posterUrl: item.posterUrl, title: item.title, score };
        }
      }
      if (!counted.has(contributor.id)) {
        counted.add(contributor.id);
        person.types.set(item.mediaType, (person.types.get(item.mediaType) ?? 0) + 1);
      }
    }
  }
  return people;
});

export type ContributorSuggestion = {
  id: string;
  name: string;
  /** "Director · Actor" */
  roles: string;
  titleCount: number;
  art: PersonArt | null;
};

/**
 * Name suggestions for the credit fields on the media form: people (or, for
 * studio roles, companies) whose name has a word starting with the text,
 * most prolific first. Reads the cached catalog, never the database.
 */
export async function searchCatalogPeople(
  search: string,
  kind: ContributorKind,
  limit = 8,
): Promise<ContributorSuggestion[]> {
  const query = normalizeSearchText(search);
  if (query.length < 2) return [];
  return [...(await getCatalogPeople()).values()]
    .filter(
      (person) => person.kind === kind && ` ${person.normalized}`.includes(` ${query}`),
    )
    .sort(
      (a, b) =>
        Number(b.normalized.startsWith(query)) - Number(a.normalized.startsWith(query)) ||
        b.mediaIds.size - a.mediaIds.size ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map((person) => ({
      id: person.id,
      name: person.name,
      roles: rolesLabel(person.roles),
      titleCount: person.mediaIds.size,
      art: person.art ? { posterUrl: person.art.posterUrl, title: person.art.title } : null,
    }));
}

export type LibraryPeopleMatches = {
  /** People with a name word starting with the search, most prolific first. */
  people: PersonSummary[];
  /** How many names contain the search as whole words ("lee" → Ang Lee, Spike Lee…). */
  wholeWordCount: number;
  /** People whose name contains the search as whole words; their titles join the results. */
  merged: Array<{ id: string; name: string }>;
  mergedMediaIds: string[];
};

/**
 * People for a library search. Names are matched at word starts, so "scors"
 * finds Scorsese but "lee" doesn't find Hailee; only whole-word matches ("scorsese", not "heat" in "Heather")
 * add their titles to the results, and only when few people share the name,
 * so a common surname never floods the list with unexplained titles.
 */
export async function getLibraryPeopleMatches(
  search: string,
  limit = 5,
): Promise<LibraryPeopleMatches> {
  const query = normalizeSearchText(search.replace(/\*$/, ""));
  if (query.length < 2) {
    return { people: [], wholeWordCount: 0, merged: [], mergedMediaIds: [] };
  }
  const all = [...(await getCatalogPeople()).values()];
  const matches = all
    .filter((person) => ` ${person.normalized}`.includes(` ${query}`))
    .sort(
      (a, b) =>
        b.mediaIds.size - a.mediaIds.size || a.name.localeCompare(b.name),
    );
  const whole = matches.filter((person) =>
    ` ${person.normalized} `.includes(` ${query} `),
  );
  const merged = whole.length <= MERGE_LIMIT ? whole : [];
  return {
    wholeWordCount: whole.length,
    people: matches.slice(0, limit).map((person) => ({
      id: person.id,
      name: person.name,
      kind: person.kind,
      roles: rolesLabel(person.roles),
      titleCount: person.mediaIds.size,
      seenCount: 0,
      ratedCount: 0,
      average: null,
      delta: null,
      types: VISIBLE_MEDIA_TYPES.filter((type) => person.types.has(type)).map(
        (type) => ({ mediaType: type, count: person.types.get(type)! }),
      ),
      tiles: [],
      note: null,
      art: person.art ? { posterUrl: person.art.posterUrl, title: person.art.title } : null,
    })),
    merged: merged.map(({ id, name }) => ({ id, name })),
    mergedMediaIds: [...new Set(merged.flatMap((person) => [...person.mediaIds]))],
  };
}

export async function getPersonPageData(id: string): Promise<PersonPageData | null> {
  const { signedIn, index, means } = await getPeopleContext();
  const entry = index.get(id);
  if (!entry) return null;
  const defaultType = primaryMediaType(entry);
  if (!defaultType) return null;

  const byType = VISIBLE_MEDIA_TYPES.filter((type) =>
    entry.credits.some((credit) => credit.row.mediaType === type),
  ).map((mediaType): PersonTypeSection => {
    const mean = means.get(mediaType) ?? null;
    const stats = personStats(entry, mediaType, mean);
    const best = stats.rated[0];
    const critics = [...stats.credits]
      .filter((credit) => credit.row.computedConsensusScore != null)
      .sort(
        (a, b) => b.row.computedConsensusScore! - a.row.computedConsensusScore!,
      )[0];
    return {
      mediaType,
      mean,
      roles: rolesLabel(stats.credits.flatMap((credit) => credit.roles)),
      titleCount: stats.credits.length,
      seenCount: stats.seen.length,
      ratedCount: stats.rated.length,
      unseenCount: stats.unseen.length,
      average: stats.average,
      delta: stats.delta,
      feature: best
        ? { tile: tile(best.credit.row), score: best.score, yours: true }
        : critics
          ? {
              tile: tile(critics.row),
              score: critics.row.computedConsensusScore,
              yours: false,
            }
          : stats.credits[0]
            ? { tile: tile(stats.credits[0].row), score: null, yours: false }
            : null,
      rated: stats.rated.slice(0, 10).map(({ credit, score }) => ({
        tile: tile(credit.row),
        score,
      })),
      unseen: [...stats.unseen]
        .sort(
          (a, b) =>
            (b.row.computedConsensusScore ?? -1) - (a.row.computedConsensusScore ?? -1) ||
            byRelease(a, b),
        )
        .slice(0, 8)
        .map((credit) => ({
          tile: tile(credit.row),
          consensus: credit.row.computedConsensusScore,
          watchlisted: credit.row.status === "WATCHLIST",
        })),
      collaborators: collaborators(index, id, mediaType).map(({ entry: other, shared }) =>
        summarize(other, {
          mediaType,
          mean,
          note: `${shared} together`,
          exclude: best
            ? [best.credit.row.id]
            : critics
              ? [critics.row.id]
              : [],
        }),
      ),
      credits: [...stats.credits].sort(byRelease).map((credit) => ({
        tile: tile(credit.row),
        roles: rolesLabel(credit.roles),
        score: personalScore(credit.row),
        status: creditStatusLabel(credit.row),
        seen: isSeen(credit.row),
      })),
    };
  });

  return {
    signedIn,
    person: {
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
      roles: rolesLabel(entry.credits.flatMap((credit) => credit.roles)),
    },
    defaultType,
    byType,
  };
}

/** A credit's record with the viewer, for the caption on a detail-page tile. */
export type CreditStat = {
  titles: number;
  seen: number;
  average: number | null;
  /** Another of their titles to picture them by; never the page's own title. */
  art: PersonArt | null;
};

/**
 * Per-contributor records within one media type, for the credits on a title's
 * page ("8.2 avg · 3 of 9 seen", "3 of 9 played"). Title pages are the most
 * visited surface, so this never reads the viewer's whole library: the cached
 * catalog says which titles these people made, and only the viewer's rows for
 * those are fetched. Signed-out viewers get the art and counts without rows.
 */
export async function getCreditStats(
  userId: string | null,
  contributorIds: string[],
  mediaType: MediaType,
  currentMediaId: string,
): Promise<Record<string, CreditStat>> {
  if (!contributorIds.length) return {};
  const wanted = new Set(contributorIds);
  const titlesBy = new Map<string, Map<string, CatalogItem>>();
  for (const item of await getCatalogItems()) {
    if (item.mediaType !== mediaType) continue;
    for (const credit of item.credits) {
      const id = credit.contributor.id;
      if (!wanted.has(id)) continue;
      const titles = titlesBy.get(id) ?? new Map<string, CatalogItem>();
      titles.set(item.id, item);
      titlesBy.set(id, titles);
    }
  }
  const mediaIds = [
    ...new Set([...titlesBy.values()].flatMap((titles) => [...titles.keys()])),
  ];
  const rows =
    userId && mediaIds.length
      ? await prisma.userMedia.findMany({
          where: { userId, mediaId: { in: mediaIds } },
          select: {
            mediaId: true,
            status: true,
            personalRating: true,
            computedPersonalScore: true,
            comparisonCount: true,
            isArchived: true,
          },
        })
      : [];
  const byMedia = new Map(rows.map((row) => [row.mediaId, row]));
  const exclude = new Set([currentMediaId]);
  const stats: Record<string, CreditStat> = {};
  for (const [id, titles] of titlesBy) {
    // Catalog metadata with the viewer's fields laid over it, just enough for
    // the seen / score predicates and the art rule.
    const views = [...titles.values()].map(
      (item) =>
        ({
          ...item,
          status: "UNTRACKED",
          personalRating: null,
          computedPersonalScore: null,
          comparisonCount: 0,
          isArchived: false,
          ...byMedia.get(item.id),
          pairwiseScore: 1000,
        }) as unknown as PeopleSourceRow,
    );
    const scores = views
      .map((view) => personalScore(view))
      .filter((score): score is number => score != null);
    stats[id] = {
      titles: titles.size,
      seen: views.filter((view) => isSeen(view)).length,
      average: scores.length
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null,
      art: personArt(views, exclude),
    };
  }
  return stats;
}
