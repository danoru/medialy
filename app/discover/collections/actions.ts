"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { type MediaType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { queueToast } from "@/lib/toast";
import { requireAdmin } from "@/lib/user";

export type CollectionFormActionState = {
  message: string;
  severity: "error" | "success";
  submittedAt: number;
};

const errorState = (message: string): CollectionFormActionState => ({
  message,
  severity: "error",
  submittedAt: Date.now(),
});

/** Revalidate every surface that shows collection data. */
function revalidateCollections(id?: string) {
  revalidatePath("/discover");
  revalidatePath("/discover/collections");
  if (id) revalidatePath(`/discover/collections/${id}`);
}

function isUniqueNameError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("name")
  );
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

/** "YYYY-MM" from an <input type="month"> value, or null if blank/invalid. */
function parseMonth(value: string): string | null {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Collection CRUD
// ---------------------------------------------------------------------------

export async function createCollection(
  _state: CollectionFormActionState,
  formData: FormData,
) {
  try {
    const admin = await requireAdmin();
    const name = text(formData, "name");
    if (!name) return errorState("Give the collection a title.");

    const created = await prisma.customList.create({
      data: {
        userId: admin.id,
        kind: "COLLECTION",
        name,
        subtitle: optionalText(formData, "subtitle"),
        description: optionalText(formData, "description"),
        coverUrl: optionalText(formData, "coverUrl"),
        isPublished: formData.get("isPublished") != null,
      },
    });
    revalidateCollections(created.id);
    await queueToast(`${created.name} created.`);
    redirect(`/discover/collections/${created.id}/edit`);
  } catch (error) {
    if (isUniqueNameError(error))
      return errorState("A collection with that name already exists.");
    throw error;
  }
}

export async function updateCollection(
  id: string,
  _state: CollectionFormActionState,
  formData: FormData,
) {
  try {
    await requireAdmin();
    const name = text(formData, "name");
    if (!name) return errorState("Give the collection a title.");

    await prisma.customList.update({
      where: { id },
      data: {
        name,
        subtitle: optionalText(formData, "subtitle"),
        description: optionalText(formData, "description"),
        coverUrl: optionalText(formData, "coverUrl"),
        isPublished: formData.get("isPublished") != null,
      },
    });
    revalidateCollections(id);
    await queueToast("Collection saved.");
    return {
      message: "Collection saved.",
      severity: "success" as const,
      submittedAt: Date.now(),
    };
  } catch (error) {
    if (isUniqueNameError(error))
      return errorState("A collection with that name already exists.");
    throw error;
  }
}

export async function deleteCollection(id: string) {
  await requireAdmin();
  await prisma.customList.delete({ where: { id } });
  revalidateCollections(id);
  await queueToast("Collection deleted.");
  redirect("/discover/collections");
}

// ---------------------------------------------------------------------------
// Featured month
// ---------------------------------------------------------------------------

export async function setFeaturedMonth(id: string, formData: FormData) {
  await requireAdmin();
  const month = parseMonth(text(formData, "month"));
  if (!month) {
    await queueToast("Pick a valid month.", "error");
    return;
  }
  // One featured collection per month: clear the current holder, then set this
  // one (and publish it — a featured collection must be live).
  await prisma.$transaction([
    prisma.customList.updateMany({
      where: { featuredMonth: month, id: { not: id } },
      data: { featuredMonth: null },
    }),
    prisma.customList.update({
      where: { id },
      data: { featuredMonth: month, isPublished: true },
    }),
  ]);
  revalidateCollections(id);
  await queueToast(`Featured for ${month}.`);
}

export async function clearFeaturedMonth(id: string) {
  await requireAdmin();
  await prisma.customList.update({
    where: { id },
    data: { featuredMonth: null },
  });
  revalidateCollections(id);
  await queueToast("Cleared featured month.");
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function addSection(listId: string, formData: FormData) {
  await requireAdmin();
  const title = text(formData, "title");
  if (!title) {
    await queueToast("Give the section a title.", "error");
    return;
  }
  const last = await prisma.listSection.aggregate({
    where: { listId },
    _max: { position: true },
  });
  await prisma.listSection.create({
    data: {
      listId,
      title,
      description: optionalText(formData, "description"),
      position: (last._max.position ?? -1) + 1,
    },
  });
  revalidateCollections(listId);
  await queueToast("Section added.");
}

export async function updateSection(
  sectionId: string,
  listId: string,
  formData: FormData,
) {
  await requireAdmin();
  const title = text(formData, "title");
  if (!title) {
    await queueToast("Give the section a title.", "error");
    return;
  }
  await prisma.listSection.update({
    where: { id: sectionId },
    data: { title, description: optionalText(formData, "description") },
  });
  revalidateCollections(listId);
  await queueToast("Section saved.");
}

export async function deleteSection(sectionId: string, listId: string) {
  await requireAdmin();
  // onDelete: SetNull demotes the section's items to ungrouped rather than
  // deleting them.
  await prisma.listSection.delete({ where: { id: sectionId } });
  revalidateCollections(listId);
  await queueToast("Section removed.");
}

/**
 * Move a sub-category one slot up or down. Reads the current order, swaps the
 * target with its neighbour, then rewrites every `position` to a contiguous
 * 0..n sequence so ordering stays stable even if positions had drifted.
 */
export async function moveSection(
  sectionId: string,
  listId: string,
  direction: "up" | "down",
) {
  await requireAdmin();
  const sections = await prisma.listSection.findMany({
    where: { listId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index === -1) return;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= sections.length) return;

  const reordered = [...sections];
  [reordered[index], reordered[swapWith]] = [
    reordered[swapWith],
    reordered[index],
  ];
  await prisma.$transaction(
    reordered.map((section, position) =>
      prisma.listSection.update({ where: { id: section.id }, data: { position } }),
    ),
  );
  revalidateCollections(listId);
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function addCollectionItem(listId: string, formData: FormData) {
  await requireAdmin();
  const mediaId = text(formData, "mediaId");
  if (!mediaId) {
    await queueToast("Pick a title to add.", "error");
    return;
  }
  const sectionId = optionalText(formData, "sectionId");
  const last = await prisma.listItem.aggregate({
    where: { listId },
    _max: { rank: true },
  });
  try {
    await prisma.listItem.create({
      data: {
        listId,
        mediaId,
        sectionId,
        note: optionalText(formData, "note"),
        rank: (last._max.rank ?? 0) + 1,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await queueToast("That title is already in this collection.", "error");
      return;
    }
    throw error;
  }
  revalidateCollections(listId);
  await queueToast("Added to collection.");
}

export async function updateCollectionItem(
  itemId: string,
  listId: string,
  formData: FormData,
) {
  await requireAdmin();
  const rawRank = text(formData, "rank");
  const rank = rawRank ? Number.parseInt(rawRank, 10) : null;
  await prisma.listItem.update({
    where: { id: itemId },
    data: {
      note: optionalText(formData, "note"),
      sectionId: optionalText(formData, "sectionId"),
      rank: rank != null && !Number.isNaN(rank) ? rank : null,
    },
  });
  revalidateCollections(listId);
  await queueToast("Item saved.");
}

export async function removeCollectionItem(listId: string, itemId: string) {
  await requireAdmin();
  await prisma.listItem.deleteMany({ where: { id: itemId, listId } });
  revalidateCollections(listId);
  await queueToast("Removed from collection.");
}

/**
 * Move an item one slot up or down within its own sub-category (or the
 * ungrouped bucket). Ordering only matters relative to siblings in the same
 * section, so we reindex just that group's `rank` values to a contiguous
 * sequence — cross-section rank collisions are harmless since display groups by
 * section first.
 */
export async function moveCollectionItem(
  itemId: string,
  listId: string,
  direction: "up" | "down",
) {
  await requireAdmin();
  const item = await prisma.listItem.findFirst({
    where: { id: itemId, listId },
    select: { sectionId: true },
  });
  if (!item) return;

  const siblings = await prisma.listItem.findMany({
    where: { listId, sectionId: item.sectionId },
    orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const index = siblings.findIndex((sibling) => sibling.id === itemId);
  if (index === -1) return;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= siblings.length) return;

  const reordered = [...siblings];
  [reordered[index], reordered[swapWith]] = [
    reordered[swapWith],
    reordered[index],
  ];
  await prisma.$transaction(
    reordered.map((sibling, rank) =>
      prisma.listItem.update({ where: { id: sibling.id }, data: { rank } }),
    ),
  );
  revalidateCollections(listId);
}

/** Title search backing the collection item picker. */
export async function searchMediaForCollection(
  query: string,
): Promise<{ id: string; title: string; mediaType: MediaType }[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];
  return prisma.mediaItem.findMany({
    where: { title: { contains: q, mode: "insensitive" } },
    select: { id: true, title: true, mediaType: true },
    orderBy: { title: "asc" },
    take: 10,
  });
}
