"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MediaStatus, type MediaType, Prisma } from "@prisma/client";
import {
  findExistingMediaItem,
  mediaMutationDataWithUniqueTitle,
  replaceManualExternalRatings,
  replaceMediaConnections,
  upsertMediaRelations,
  userMediaMutationData,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { recomputeMediaScores } from "@/lib/scoring/recompute";
import { queueToast } from "@/lib/toast";
import {
  mediaFormInputFromFormData,
  parseOptionalRating,
} from "@/lib/validation";
import { upsertUserMedia } from "@/lib/db/user-media";
import { requireUser, requireUserId } from "@/lib/user";
import { inputToSnapshot, snapshotMediaItem } from "@/lib/edit-suggestions";
import { statusAfterRating } from "@/lib/status-rules";

export type MediaFormActionState = {
  message: string;
  severity: "error" | "success";
  submittedAt: number;
};

const duplicateMediaState = (): MediaFormActionState => ({
  message: "Media item already exists.",
  severity: "error",
  submittedAt: Date.now(),
});

export async function createMediaItem(
  _state: MediaFormActionState,
  formData: FormData,
) {
  try {
    const user = await requireUser();
    const input = mediaFormInputFromFormData(formData);

    if (!user.isAdmin) {
      await prisma.mediaEditSuggestion.create({
        data: {
          mediaId: null,
          userId: user.id,
          beforeJson: null,
          afterJson: JSON.stringify(inputToSnapshot(input)),
        },
      });
      revalidatePath("/admin/edits");
      revalidatePath("/admin");
      await queueToast("Thanks! Your addition was sent for admin review.");
      redirect("/library");
    }

    const media = await prisma.$transaction(async (tx) => {
      const existing = await findExistingMediaItem(tx, input);
      if (existing) return null;

      const data = await mediaMutationDataWithUniqueTitle(tx, input);
      const created = await tx.mediaItem.create({
        data: { ...data, createdById: user.id },
      });
      await tx.userMedia.create({
        data: {
          userId: user.id,
          mediaId: created.id,
          ...userMediaMutationData(input),
        },
      });
      return created;
    });

    if (!media) return duplicateMediaState();

    await upsertMediaRelations(media.id, input);
    await replaceMediaConnections(media.id, input);
    await replaceManualExternalRatings(media.id, input);
    await recomputeMediaScores(media.id, user.id);
    revalidatePath("/library");
    revalidatePath("/upcoming");
    await queueToast(`${media.title} added.`);
    redirect(`/media/${media.id}`);
  } catch (error) {
    if (isUniqueMediaTitleError(error)) return duplicateMediaState();
    throw error;
  }
}

export async function updateMediaItem(
  id: string,
  _state: MediaFormActionState,
  formData: FormData,
) {
  try {
    const user = await requireUser();
    const input = mediaFormInputFromFormData(formData);

    if (!user.isAdmin) {
      const before = await snapshotMediaItem(id);
      await prisma.mediaEditSuggestion.create({
        data: {
          mediaId: id,
          userId: user.id,
          beforeJson: before ? JSON.stringify(before) : null,
          afterJson: JSON.stringify(inputToSnapshot(input)),
        },
      });
      revalidatePath("/admin/edits");
      revalidatePath("/admin");
      await queueToast("Thanks! Your edit was sent for admin review.");
      redirect(`/media/${id}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await findExistingMediaItem(tx, input, id);
      if (existing) return false;

      const data = await mediaMutationDataWithUniqueTitle(tx, input, id);
      await tx.mediaItem.update({
        where: { id },
        data,
      });
      // The metadata form carries no per-user fields any more, so this is
      // usually empty — don't create a stray UserMedia row for nothing.
      const userData = userMediaMutationData(input);
      if (Object.keys(userData).length > 0) {
        await upsertUserMedia(user.id, id, userData, tx);
      }
      return true;
    });

    if (!updated) return duplicateMediaState();

    await upsertMediaRelations(id, input);
    await replaceMediaConnections(id, input);
    await replaceManualExternalRatings(id, input);
    await recomputeMediaScores(id, user.id);
    revalidatePath("/library");
    revalidatePath("/upcoming");
    revalidatePath(`/media/${id}`);
    await queueToast("Media item saved.");
    redirect(`/media/${id}`);
  } catch (error) {
    if (isUniqueMediaTitleError(error)) return duplicateMediaState();
    throw error;
  }
}

/** Pages whose content depends on the viewer's ratings/statuses. */
function revalidateUserMediaViews(id?: string) {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/library");
  revalidatePath("/watchlist");
  revalidatePath("/discover");
  if (id) revalidatePath(`/media/${id}`);
}

export type RateResult = {
  personalRating: number | null;
  /** Status the item is on now. */
  status: MediaStatus;
  /** Status it was on before — what an Undo should restore. */
  previousStatus: MediaStatus;
  /** True when this rating promoted the item to COMPLETED. */
  autoCompleted: boolean;
};

/**
 * Rate an item. Rating something you hadn't started implies you finished it, so
 * we promote the status (see `statusAfterRating`) rather than nagging with a
 * follow-up prompt. Returns what happened so the client can surface it — and
 * offer an Undo — instead of silently changing state behind the user's back.
 */
export async function updateMediaRating(
  id: string,
  formData: FormData,
): Promise<RateResult> {
  const personalRating = parseOptionalRating(formData.get("personalRating"));
  const userId = await requireUserId();

  const existing = await prisma.userMedia.findUnique({
    where: { userId_mediaId: { userId, mediaId: id } },
    select: { status: true },
  });
  const previousStatus: MediaStatus = existing?.status ?? "UNTRACKED";

  // Clearing a rating is not a statement that you watched it — only promote on
  // an actual score.
  const promoted =
    personalRating == null ? null : statusAfterRating(previousStatus);

  await upsertUserMedia(userId, id, {
    personalRating,
    ...(promoted ? { status: promoted } : {}),
  });
  await recomputeMediaScores(id, userId);
  revalidateUserMediaViews(id);

  return {
    personalRating,
    status: promoted ?? previousStatus,
    previousStatus,
    autoCompleted: promoted != null,
  };
}

export async function updateMediaStatus(id: string, formData: FormData) {
  const status = String(formData.get("status") ?? "");
  if (!isMediaStatus(status)) {
    await queueToast("Invalid status.", "error");
    return;
  }

  const userId = await requireUserId();
  await upsertUserMedia(userId, id, { status });
  revalidateUserMediaViews(id);
}

/** Direct status write used by Undo and by the Watched toggle. */
export async function setMediaStatus(id: string, status: MediaStatus) {
  if (!isMediaStatus(status)) return;
  const userId = await requireUserId();
  await upsertUserMedia(userId, id, { status });
  revalidateUserMediaViews(id);
}

/**
 * The Letterboxd-style Watched toggle. Un-watching returns the item to
 * UNTRACKED — we don't try to reconstruct whatever it was before, because that
 * history isn't stored and guessing would be worse than a predictable reset.
 */
export async function setMediaWatched(id: string, watched: boolean) {
  const userId = await requireUserId();
  await upsertUserMedia(userId, id, {
    status: watched ? "COMPLETED" : "UNTRACKED",
  });
  revalidateUserMediaViews(id);
}

export async function toggleFavoriteMediaItem(id: string) {
  const userId = await requireUserId();
  const item = await prisma.userMedia.findUnique({
    where: { userId_mediaId: { userId, mediaId: id } },
    select: { isFavorite: true },
  });
  const isFavorite = !(item?.isFavorite ?? false);
  await upsertUserMedia(userId, id, { isFavorite });
  revalidatePath("/library");
  revalidatePath(`/media/${id}`);
  await queueToast(isFavorite ? "Added to favorites." : "Removed favorite.");
}

export async function archiveMediaItem(id: string) {
  const userId = await requireUserId();
  await upsertUserMedia(userId, id, { isArchived: true });
  revalidatePath("/library");
  await queueToast("Media item archived.");
  redirect("/library");
}

export async function unarchiveMediaItem(id: string) {
  const userId = await requireUserId();
  await upsertUserMedia(userId, id, { isArchived: false });
  revalidatePath("/library");
  await queueToast("Media item unarchived.");
  redirect(`/media/${id}`);
}

export async function deleteMediaItem(id: string) {
  const user = await requireUser();
  if (!user.isAdmin) {
    await queueToast("Only admins can delete shared catalog items.");
    redirect(`/media/${id}`);
  }
  await prisma.mediaItem.delete({ where: { id } });
  revalidatePath("/library");
  await queueToast("Media item deleted.");
  redirect("/library");
}

export async function addNote(id: string, formData: FormData) {
  const userId = await requireUserId();
  const body = String(formData.get("body") ?? "").trim();
  if (body) {
    await prisma.note.create({ data: { userId, mediaId: id, body } });
  }
  revalidatePath(`/media/${id}`);
}

export async function updateNote(
  noteId: string,
  mediaId: string,
  formData: FormData,
) {
  const userId = await requireUserId();
  const body = String(formData.get("body") ?? "").trim();
  if (body) {
    await prisma.note.updateMany({
      where: { id: noteId, userId },
      data: { body },
    });
  } else {
    await prisma.note.deleteMany({ where: { id: noteId, userId } });
  }
  revalidatePath(`/media/${mediaId}`);
}

function isUniqueMediaTitleError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("title") &&
    error.meta.target.includes("mediaType")
  );
}

function isMediaStatus(value: string): value is MediaStatus {
  return Object.values(MediaStatus).includes(value as MediaStatus);
}

/** Title search backing the relation-target picker on the edit page. */
export async function searchMediaItemsForRelation(
  excludeId: string,
  query: string,
): Promise<{ id: string; title: string; mediaType: MediaType }[]> {
  await requireUserId();
  const q = query.trim();
  if (q.length < 2) return [];
  return prisma.mediaItem.findMany({
    where: {
      id: { not: excludeId },
      title: { contains: q, mode: "insensitive" },
    },
    select: { id: true, title: true, mediaType: true },
    orderBy: { title: "asc" },
    take: 10,
  });
}
