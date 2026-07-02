import type { MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Media fields a collection item needs to render a poster tile + link. */
export type CollectionMedia = {
  id: string;
  title: string;
  mediaType: MediaType;
  posterUrl: string | null;
  releaseDate: Date | null;
};

/** One curated item: a media entry plus its editorial note and placement. */
export type CollectionItem = {
  id: string;
  sectionId: string | null;
  rank: number | null;
  note: string | null;
  media: CollectionMedia;
};

export type CollectionSection = {
  id: string;
  title: string;
  description: string | null;
  position: number;
};

/** A collection stripped to what the index grid needs. */
export type CollectionSummary = {
  id: string;
  name: string;
  subtitle: string | null;
  coverUrl: string | null;
  isPublished: boolean;
  featuredMonth: string | null;
  itemCount: number;
};

/** Items grouped under their section, with ungrouped items surfaced first. */
export type CollectionSectionGroup = {
  section: CollectionSection;
  items: CollectionItem[];
};

export type CollectionDetail = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  coverUrl: string | null;
  isPublished: boolean;
  featuredMonth: string | null;
  ungrouped: CollectionItem[];
  sectionGroups: CollectionSectionGroup[];
};

/** Current month as a `"YYYY-MM"` key, from the server clock. */
export function currentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Buckets items into their sections (ordered by `position`) and a leading
 * "ungrouped" list for items with no `sectionId`. Pure — unit-testable without
 * a DB. Items keep whatever order they arrive in (callers sort by rank first).
 */
export function groupItemsBySection(
  sections: CollectionSection[],
  items: CollectionItem[],
): { ungrouped: CollectionItem[]; sectionGroups: CollectionSectionGroup[] } {
  const bySection = new Map<string, CollectionItem[]>();
  const ungrouped: CollectionItem[] = [];
  for (const item of items) {
    if (item.sectionId == null) {
      ungrouped.push(item);
      continue;
    }
    const bucket = bySection.get(item.sectionId) ?? [];
    bucket.push(item);
    bySection.set(item.sectionId, bucket);
  }

  const sectionGroups = [...sections]
    .sort((a, b) => a.position - b.position)
    .map((section) => ({
      section,
      items: bySection.get(section.id) ?? [],
    }));

  return { ungrouped, sectionGroups };
}

/**
 * Editorial collections (kind = COLLECTION), newest-featured first. Drafts are
 * only returned when `includeDrafts` is set (admins); everyone else sees just
 * published collections.
 */
export async function listCollections({
  includeDrafts,
}: {
  includeDrafts: boolean;
}): Promise<CollectionSummary[]> {
  const rows = await prisma.customList.findMany({
    where: { kind: "COLLECTION", ...(includeDrafts ? {} : { isPublished: true }) },
    orderBy: [{ featuredMonth: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      subtitle: true,
      coverUrl: true,
      isPublished: true,
      featuredMonth: true,
      _count: { select: { items: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    coverUrl: row.coverUrl,
    isPublished: row.isPublished,
    featuredMonth: row.featuredMonth,
    itemCount: row._count.items,
  }));
}

/** One collection with its sections + items grouped for rendering. */
export async function getCollection(id: string): Promise<CollectionDetail | null> {
  const row = await prisma.customList.findFirst({
    where: { id, kind: "COLLECTION" },
    select: {
      id: true,
      name: true,
      subtitle: true,
      description: true,
      coverUrl: true,
      isPublished: true,
      featuredMonth: true,
      sections: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, description: true, position: true },
      },
      items: {
        orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          sectionId: true,
          rank: true,
          note: true,
          media: {
            select: {
              id: true,
              title: true,
              mediaType: true,
              posterUrl: true,
              releaseDate: true,
            },
          },
        },
      },
    },
  });
  if (!row) return null;

  const { ungrouped, sectionGroups } = groupItemsBySection(
    row.sections,
    row.items,
  );

  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    description: row.description,
    coverUrl: row.coverUrl,
    isPublished: row.isPublished,
    featuredMonth: row.featuredMonth,
    ungrouped,
    sectionGroups,
  };
}

/**
 * The published collection featured for `month` (defaults to the current
 * month), or the most recently updated published collection as a fallback so
 * Discover always has something to headline. Returns null if none are live.
 */
export async function getFeaturedCollection(
  month: string = currentMonth(),
): Promise<CollectionDetail | null> {
  const featured = await prisma.customList.findFirst({
    where: { kind: "COLLECTION", isPublished: true, featuredMonth: month },
    select: { id: true },
  });
  if (featured) return getCollection(featured.id);

  const fallback = await prisma.customList.findFirst({
    where: { kind: "COLLECTION", isPublished: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return fallback ? getCollection(fallback.id) : null;
}
