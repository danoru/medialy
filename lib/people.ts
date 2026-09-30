import type {
  ContributorKind,
  CreditRole,
  MediaStatus,
  MediaType,
} from "@prisma/client";
import { creditRoleNoun } from "@/lib/credits";
import { explicitRating } from "@/lib/scoring/recommendationV2";
import { statusLabel } from "@/lib/status-labels";
import { normalizeSearchText } from "@/lib/text-normalization";

/**
 * People: the directors, creators, cast and studios behind the catalog.
 *
 * Nothing here is stored per person. A person's page is computed on demand
 * from the cached catalog (`getCatalogWithUser`) — the credits are already in
 * it — so there are no extra reads, no new tables, and nothing to keep in
 * sync. These functions are pure so they can be tested without a database.
 */

/** A catalog row as this module needs it: shared metadata plus the viewer's fields. */
export type PeopleSourceRow = {
  id: string;
  title: string;
  mediaType: MediaType;
  posterUrl: string | null;
  releaseDate: Date | null;
  computedConsensusScore: number | null;
  credits: Array<{
    role: CreditRole;
    order: number;
    contributor: { id: string; name: string; kind: ContributorKind };
  }>;
  status: MediaStatus;
  personalRating: number | null;
  computedPersonalScore: number | null;
  pairwiseScore: number;
  comparisonCount: number;
  isArchived: boolean;
  completedAt: Date | null;
};

/** One title in a person's career. A director who also acts has one entry, two roles. */
export type PersonCredit = {
  row: PeopleSourceRow;
  roles: CreditRole[];
  /** Billing position of the highest-billed role. */
  order: number;
};

export type PersonEntry = {
  id: string;
  name: string;
  kind: ContributorKind;
  credits: PersonCredit[];
};

export type PeopleIndex = Map<string, PersonEntry>;

/** How far a small sample is pulled toward your usual score — two phantom ratings. */
export const PEOPLE_SHRINK_K = 2;
/** Ratings needed before a person can lead a ranking. */
export const PEOPLE_MIN_RATED = 2;
/** How far above your usual a person must sit to count as someone you love. */
export const LOVED_MARGIN = 0.5;

/** Statuses that mean you have experienced a title (mirrors the profile). */
const EXPERIENCED_STATUSES: ReadonlySet<MediaStatus> = new Set([
  "COMPLETED",
  "IN_PROGRESS",
  "PAUSED",
  "DROPPED",
]);

/**
 * The role filters each type offers. The type switcher picks the type; this is
 * a filter within it, never a second switcher.
 */
export const ROLE_GROUPS: Record<
  MediaType,
  Array<{ key: string; label: string; roles: CreditRole[] }>
> = {
  MOVIE: [
    { key: "directors", label: "Directors", roles: ["DIRECTOR"] },
    { key: "cast", label: "Cast", roles: ["ACTOR"] },
  ],
  TV_SHOW: [
    { key: "creators", label: "Creators", roles: ["CREATOR"] },
    { key: "cast", label: "Cast", roles: ["ACTOR"] },
  ],
  VIDEO_GAME: [
    { key: "developers", label: "Developers", roles: ["DEVELOPER"] },
    { key: "publishers", label: "Publishers", roles: ["PUBLISHER"] },
  ],
  BOOK: [],
  BOARD_GAME: [],
  MUSIC: [],
  MUSICAL: [{ key: "cast", label: "Cast", roles: ["ACTOR"] }],
};


/** Roles in the order a person is described: behind the camera first. */
const ROLE_ORDER: CreditRole[] = [
  "DIRECTOR",
  "CREATOR",
  "DEVELOPER",
  "PUBLISHER",
  "ACTOR",
];

export const roleNoun = creditRoleNoun;

/** "Director · Actor" — every role the person holds, in a stable order. */
export function rolesLabel(roles: Iterable<CreditRole>): string {
  const held = new Set(roles);
  return ROLE_ORDER.filter((role) => held.has(role))
    .map(roleNoun)
    .join(" · ");
}

/** "films", "shows", "games" — for sentences. */
export function titleNoun(mediaType: MediaType, count = 2): string {
  const plural: Partial<Record<MediaType, [string, string]>> = {
    MOVIE: ["film", "films"],
    TV_SHOW: ["show", "shows"],
    VIDEO_GAME: ["game", "games"],
  };
  const [one, many] = plural[mediaType] ?? ["title", "titles"];
  return count === 1 ? one : many;
}

/**
 * Your score for a row, or null. Only titles you actually rated count — "you
 * rate Scorsese 8.2" should average ratings you gave, not comparisons alone.
 * Where a real rating exists this is the refined personal score the profile
 * ranks by (never the raw pairwise Elo). A stored 0 is a placeholder the rating
 * control can't produce, so it is no rating, and the score saved alongside it
 * is ignored.
 */
export function personalScore(row: PeopleSourceRow): number | null {
  if (row.isArchived) return null;
  const explicit = explicitRating(row.personalRating);
  if (explicit == null) return null;
  return row.computedPersonalScore ?? explicit;
}

/** Whether you have experienced a title: an experienced status or a score. */
export function isSeen(row: PeopleSourceRow): boolean {
  if (row.isArchived) return false;
  return (
    EXPERIENCED_STATUSES.has(row.status) ||
    personalScore(row) != null ||
    row.comparisonCount > 0
  );
}

/** Group every credit in the catalog by contributor. */
export function buildPeopleIndex(rows: PeopleSourceRow[]): PeopleIndex {
  const index: PeopleIndex = new Map();
  for (const row of rows) {
    const byContributor = new Map<string, PersonCredit>();
    for (const credit of row.credits) {
      const { contributor } = credit;
      let entry = index.get(contributor.id);
      if (!entry) {
        entry = {
          id: contributor.id,
          name: contributor.name,
          kind: contributor.kind,
          credits: [],
        };
        index.set(contributor.id, entry);
      }
      const existing = byContributor.get(contributor.id);
      if (existing) {
        if (!existing.roles.includes(credit.role)) existing.roles.push(credit.role);
        existing.order = Math.min(existing.order, credit.order);
      } else {
        const personCredit = { row, roles: [credit.role], order: credit.order };
        byContributor.set(contributor.id, personCredit);
        entry.credits.push(personCredit);
      }
    }
  }
  return index;
}

/** Your mean score per media type — the baseline every "vs you" is measured from. */
export function userMeans(rows: PeopleSourceRow[]): Map<MediaType, number> {
  const sums = new Map<MediaType, { sum: number; count: number }>();
  for (const row of rows) {
    const score = personalScore(row);
    if (score == null) continue;
    const bucket = sums.get(row.mediaType) ?? { sum: 0, count: 0 };
    bucket.sum += score;
    bucket.count += 1;
    sums.set(row.mediaType, bucket);
  }
  return new Map(
    [...sums].map(([type, { sum, count }]) => [type, sum / count]),
  );
}

export type PersonStats = {
  credits: PersonCredit[];
  rated: Array<{ credit: PersonCredit; score: number }>;
  seen: PersonCredit[];
  unseen: PersonCredit[];
  average: number | null;
  /** The average pulled toward your usual score, so one 10/10 can't top a ranking. */
  shrunk: number | null;
  /** `average` minus your usual score for the type. */
  delta: number | null;
};

/** A person's record with you for one type, optionally limited to some roles. */
export function personStats(
  entry: PersonEntry,
  mediaType: MediaType,
  mean: number | null | undefined,
  roles?: readonly CreditRole[],
): PersonStats {
  const credits = entry.credits.filter(
    (credit) =>
      credit.row.mediaType === mediaType &&
      (!roles || credit.roles.some((role) => roles.includes(role))),
  );
  const rated: PersonStats["rated"] = [];
  const seen: PersonCredit[] = [];
  const unseen: PersonCredit[] = [];
  for (const credit of credits) {
    const score = personalScore(credit.row);
    if (score != null) rated.push({ credit, score });
    if (isSeen(credit.row)) seen.push(credit);
    else if (!credit.row.isArchived) unseen.push(credit);
  }
  rated.sort((a, b) => b.score - a.score);
  const sum = rated.reduce((total, entry) => total + entry.score, 0);
  const average = rated.length ? sum / rated.length : null;
  const shrunk =
    average == null
      ? null
      : mean == null
        ? average
        : (sum + PEOPLE_SHRINK_K * mean) / (rated.length + PEOPLE_SHRINK_K);
  return {
    credits,
    rated,
    seen,
    unseen,
    average,
    shrunk,
    delta: average != null && mean != null ? average - mean : null,
  };
}

/** The people you rate highest in some roles, best first. */
export function topPeople(
  index: PeopleIndex,
  mediaType: MediaType,
  mean: number | null | undefined,
  roles: readonly CreditRole[],
  { limit = 8, minRated = PEOPLE_MIN_RATED } = {},
) {
  const ranked: Array<{ entry: PersonEntry; stats: PersonStats }> = [];
  for (const entry of index.values()) {
    const stats = personStats(entry, mediaType, mean, roles);
    if (stats.rated.length < minRated) continue;
    ranked.push({ entry, stats });
  }
  return ranked
    .sort(
      (a, b) =>
        (b.stats.shrunk ?? 0) - (a.stats.shrunk ?? 0) ||
        b.stats.rated.length - a.stats.rated.length ||
        a.entry.name.localeCompare(b.entry.name),
    )
    .slice(0, limit);
}

/**
 * People you clearly rate above your usual who still have titles you haven't
 * seen. Ranked by how much you like them and how much is left, so a loved
 * director with four unseen films leads one with a single gap.
 */
export function unfinishedBusiness(
  index: PeopleIndex,
  mediaType: MediaType,
  mean: number | null | undefined,
  { limit = 6, minRated = PEOPLE_MIN_RATED } = {},
) {
  if (mean == null) return [];
  const candidates: Array<{ entry: PersonEntry; stats: PersonStats; weight: number }> = [];
  for (const entry of index.values()) {
    const stats = personStats(entry, mediaType, mean);
    if (stats.rated.length < minRated || !stats.unseen.length) continue;
    const lift = (stats.shrunk ?? mean) - mean;
    if (lift < LOVED_MARGIN) continue;
    candidates.push({ entry, stats, weight: lift * Math.log1p(stats.unseen.length) });
  }
  return candidates
    .sort((a, b) => b.weight - a.weight || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit);
}

/**
 * The people behind what you finished most recently: each title's lead
 * creative roles and its top two billed actors, newest first, one row each.
 */
export function recentPeople(
  index: PeopleIndex,
  rows: PeopleSourceRow[],
  mediaType: MediaType,
  { limit = 8, titles = 6 } = {},
) {
  const recent = rows
    .filter(
      (row) =>
        row.mediaType === mediaType &&
        row.status === "COMPLETED" &&
        !row.isArchived &&
        row.completedAt,
    )
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())
    .slice(0, titles);
  const picked: Array<{ entry: PersonEntry; from: PeopleSourceRow }> = [];
  const seenIds = new Set<string>();
  for (const row of recent) {
    const leads = [...row.credits]
      .filter((credit) => credit.role !== "ACTOR" || credit.order < 2)
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.order - b.order);
    for (const credit of leads) {
      if (seenIds.has(credit.contributor.id)) continue;
      const entry = index.get(credit.contributor.id);
      if (!entry) continue;
      seenIds.add(entry.id);
      picked.push({ entry, from: row });
      if (picked.length >= limit) return picked;
    }
  }
  return picked;
}

/** Everyone who shares at least `minShared` titles of a type with this person. */
export function collaborators(
  index: PeopleIndex,
  personId: string,
  mediaType: MediaType,
  { limit = 8, minShared = 2 } = {},
) {
  const entry = index.get(personId);
  if (!entry) return [];
  const shared = new Map<string, number>();
  for (const credit of entry.credits) {
    if (credit.row.mediaType !== mediaType) continue;
    const others = new Set(credit.row.credits.map((c) => c.contributor.id));
    others.delete(personId);
    for (const id of others) shared.set(id, (shared.get(id) ?? 0) + 1);
  }
  return [...shared]
    .filter(([, count]) => count >= minShared)
    .map(([id, count]) => ({ entry: index.get(id)!, shared: count }))
    .filter((match) => match.entry)
    .sort(
      (a, b) =>
        b.shared - a.shared || a.entry.name.localeCompare(b.entry.name),
    )
    .slice(0, limit);
}

/**
 * Name search over everyone credited in the catalog. Same rules as the title
 * search: accent- and case-folded substring, or a prefix match when the query
 * ends in `*`. People you know come first, then the most prolific.
 */
export function searchPeople(index: PeopleIndex, search: string, { limit = 30 } = {}) {
  const trimmed = search.trim();
  const startsWith = trimmed.endsWith("*");
  const query = normalizeSearchText(startsWith ? trimmed.slice(0, -1) : trimmed);
  if (!query) return [];
  const matches: Array<{ entry: PersonEntry; seen: number }> = [];
  for (const entry of index.values()) {
    const name = normalizeSearchText(entry.name);
    const hit = startsWith
      ? name.startsWith(query)
      : name.includes(query);
    if (!hit) continue;
    matches.push({
      entry,
      seen: entry.credits.filter((credit) => isSeen(credit.row)).length,
    });
  }
  return matches
    .sort(
      (a, b) =>
        b.seen - a.seen ||
        b.entry.credits.length - a.entry.credits.length ||
        a.entry.name.localeCompare(b.entry.name),
    )
    .slice(0, limit);
}

/** The type a person is best known for: where most of their credits are. */
export function primaryMediaType(entry: PersonEntry): MediaType | null {
  const counts = new Map<MediaType, number>();
  for (const credit of entry.credits) {
    counts.set(credit.row.mediaType, (counts.get(credit.row.mediaType) ?? 0) + 1);
  }
  let best: MediaType | null = null;
  for (const [type, count] of counts) {
    if (best == null || count > (counts.get(best) ?? 0)) best = type;
  }
  return best;
}

/** The status word shown against a credit ("Watched", "Playing"), or null. */
export function creditStatusLabel(row: PeopleSourceRow): string | null {
  if (row.isArchived || row.status === "UNTRACKED") return null;
  return statusLabel(row.status, row.mediaType);
}

/** The poster that stands in for a person: a title of theirs, and where it came from. */
export type PersonArt = { posterUrl: string; title: string };

/**
 * The poster to show as a person's avatar. We hold no portraits, so a person is
 * pictured by their work: your highest-rated title of theirs, else their best
 * reviewed, else any with a poster. Titles already on screen beside the avatar
 * (the page's own title, a row's source) are skipped so the avatar says
 * something new; if nothing else has a poster, there is no art.
 */
export function personArt(
  rows: Iterable<PeopleSourceRow>,
  exclude: ReadonlySet<string> = new Set(),
): PersonArt | null {
  let best: { row: PeopleSourceRow; rank: [number, number] } | null = null;
  for (const row of rows) {
    if (!row.posterUrl || exclude.has(row.id)) continue;
    const rank: [number, number] = [
      personalScore(row) ?? -1,
      row.computedConsensusScore ?? -1,
    ];
    if (
      !best ||
      rank[0] > best.rank[0] ||
      (rank[0] === best.rank[0] && rank[1] > best.rank[1])
    ) {
      best = { row, rank };
    }
  }
  return best ? { posterUrl: best.row.posterUrl!, title: best.row.title } : null;
}
