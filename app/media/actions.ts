"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MediaStatus, Prisma } from "@prisma/client";
import {
  findExistingMediaItem,
  mediaMutationDataWithUniqueTitle,
  replaceManualExternalRatings,
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
      await queueToast(
        "Thanks! Your addition was sent for admin review.",
      );
      redirect("/media");
    }

    const media = await prisma.$transaction(async (tx) => {
      const existing = await findExistingMediaItem(tx, input);
      if (existing) return null;

      const data = await mediaMutationDataWithUniqueTitle(tx, input);
      const created = await tx.mediaItem.create({ data });
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
    await replaceManualExternalRatings(media.id, input);
    await recomputeMediaScores(media.id, user.id);
    revalidatePath("/media");
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
      await queueToast(
        "Thanks! Your edit was sent for admin review.",
      );
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
      await upsertUserMedia(user.id, id, userMediaMutationData(input), tx);
      return true;
    });

    if (!updated) return duplicateMediaState();

    await upsertMediaRelations(id, input);
    await replaceManualExternalRatings(id, input);
    await recomputeMediaScores(id, user.id);
    revalidatePath("/media");
    revalidatePath(`/media/${id}`);
    await queueToast("Media item saved.");
    redirect(`/media/${id}`);
  } catch (error) {
    if (isUniqueMediaTitleError(error)) return duplicateMediaState();
    throw error;
  }
}

export async function updateMediaRatings(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "/media");
  const ids = formData
    .getAll("mediaId")
    .map((value) => String(value))
    .filter(Boolean);

  const userId = await requireUserId();
  let updatedCount = 0;
  const newlyRatedIds: string[] = [];

  for (const id of ids) {
    const personalRating = parseOptionalRating(formData.get(`rating:${id}`));
    const currentRating = parseOptionalRating(formData.get(`current:${id}`));

    if (personalRating === currentRating) continue;

    await upsertUserMedia(userId, id, { personalRating });
    await recomputeMediaScores(id, userId);
    updatedCount += 1;
    if (personalRating != null && currentRating == null) {
      newlyRatedIds.push(id);
    }
  }

  // Find newly-rated rows that are still UNTRACKED so the page can prompt the
  // user to set a status. Items where the rating just moved (e.g. 7 → 8) or
  // got cleared are ignored — this is for the first-rating case only.
  const untrackedNewlyRated =
    newlyRatedIds.length > 0
      ? await prisma.userMedia.findMany({
          where: {
            userId,
            mediaId: { in: newlyRatedIds },
            status: "UNTRACKED",
          },
          select: { mediaId: true },
        })
      : [];

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/media");
  revalidatePath("/recommendations");
  revalidatePath("/discover");
  await queueToast(
    updatedCount === 0
      ? "No rating changes to save."
      : `Saved ${updatedCount} rating${updatedCount === 1 ? "" : "s"}.`,
  );

  let destination = returnTo.startsWith("/media") ? returnTo : "/media";
  if (untrackedNewlyRated.length > 0) {
    const reviewIds = untrackedNewlyRated.map((row) => row.mediaId).join(",");
    const separator = destination.includes("?") ? "&" : "?";
    destination = `${destination}${separator}reviewStatus=${encodeURIComponent(reviewIds)}`;
  }
  redirect(destination);
}

export async function updateMediaStatuses(formData: FormData) {
  const userId = await requireUserId();
  const ids = formData
    .getAll("mediaId")
    .map((value) => String(value))
    .filter(Boolean);

  let updatedCount = 0;
  for (const id of ids) {
    const value = String(formData.get(`status:${id}`) ?? "");
    if (!value || value === "UNTRACKED") continue;
    if (!isMediaStatus(value)) continue;
    await upsertUserMedia(userId, id, { status: value });
    updatedCount += 1;
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/media");
  revalidatePath("/recommendations");
  revalidatePath("/discover");
  await queueToast(
    updatedCount === 0
      ? "No status changes."
      : `Updated ${updatedCount} status${updatedCount === 1 ? "" : "es"}.`,
  );

  const returnTo = String(formData.get("returnTo") ?? "/media");
  redirect(returnTo.startsWith("/media") ? returnTo.split("?")[0] : "/media");
}

export async function updateMediaRating(id: string, formData: FormData) {
  const personalRating = parseOptionalRating(formData.get("personalRating"));
  const userId = await requireUserId();
  await upsertUserMedia(userId, id, { personalRating });
  await recomputeMediaScores(id, userId);
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
  revalidatePath("/recommendations");
  revalidatePath("/discover");
  await queueToast(
    personalRating == null ? "Rating cleared." : "Rating saved.",
  );
}

export async function updateMediaStatus(id: string, formData: FormData) {
  const status = String(formData.get("status") ?? "");
  if (!isMediaStatus(status)) {
    await queueToast("Invalid status.", "error");
    return;
  }

  const userId = await requireUserId();
  await upsertUserMedia(userId, id, { status });
  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
  revalidatePath("/recommendations");
  revalidatePath("/discover");
  await queueToast("Status saved.");
}

export async function toggleFavoriteMediaItem(id: string) {
  const userId = await requireUserId();
  const item = await prisma.userMedia.findUnique({
    where: { userId_mediaId: { userId, mediaId: id } },
    select: { isFavorite: true },
  });
  const isFavorite = !(item?.isFavorite ?? false);
  await upsertUserMedia(userId, id, { isFavorite });
  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
  revalidatePath("/recommendations");
  await queueToast(isFavorite ? "Added to favorites." : "Removed favorite.");
}

export async function archiveMediaItem(id: string) {
  const userId = await requireUserId();
  await upsertUserMedia(userId, id, { isArchived: true });
  revalidatePath("/media");
  await queueToast("Media item archived.");
  redirect("/media");
}

export async function unarchiveMediaItem(id: string) {
  const userId = await requireUserId();
  await upsertUserMedia(userId, id, { isArchived: false });
  revalidatePath("/media");
  await queueToast("Media item unarchived.");
  redirect(`/media/${id}`);
}

export async function deleteMediaItem(id: string) {
  await prisma.mediaItem.delete({ where: { id } });
  revalidatePath("/media");
  await queueToast("Media item deleted.");
  redirect("/media");
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
  const body = String(formData.get("body") ?? "").trim();
  if (body) {
    await prisma.note.update({ where: { id: noteId }, data: { body } });
  } else {
    await prisma.note.delete({ where: { id: noteId } });
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
