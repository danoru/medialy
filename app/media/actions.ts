"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MediaStatus, Prisma } from "@prisma/client";
import {
  findExistingMediaItem,
  mediaMutationDataWithUniqueTitle,
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
import { requireUserId } from "@/lib/user";

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
    const userId = await requireUserId();
    const input = mediaFormInputFromFormData(formData);
    const media = await prisma.$transaction(async (tx) => {
      const existing = await findExistingMediaItem(tx, input);
      if (existing) return null;

      const data = await mediaMutationDataWithUniqueTitle(tx, input);
      const created = await tx.mediaItem.create({ data });
      await tx.userMedia.create({
        data: { userId, mediaId: created.id, ...userMediaMutationData(input) },
      });
      return created;
    });

    if (!media) return duplicateMediaState();

    await upsertMediaRelations(media.id, input);
    await recomputeMediaScores(media.id, userId);
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
    const userId = await requireUserId();
    const input = mediaFormInputFromFormData(formData);
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await findExistingMediaItem(tx, input, id);
      if (existing) return false;

      const data = await mediaMutationDataWithUniqueTitle(tx, input, id);
      await tx.mediaItem.update({
        where: { id },
        data,
      });
      await upsertUserMedia(userId, id, userMediaMutationData(input), tx);
      return true;
    });

    if (!updated) return duplicateMediaState();

    await upsertMediaRelations(id, input);
    await recomputeMediaScores(id, userId);
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

  for (const id of ids) {
    const personalRating = parseOptionalRating(formData.get(`rating:${id}`));
    const currentRating = parseOptionalRating(formData.get(`current:${id}`));

    if (personalRating === currentRating) continue;

    await upsertUserMedia(userId, id, { personalRating });
    await recomputeMediaScores(id, userId);
    updatedCount += 1;
  }

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
  redirect(returnTo.startsWith("/media") ? returnTo : "/media");
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
