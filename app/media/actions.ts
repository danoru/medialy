"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { mediaMutationData, upsertTaxonomy } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { recomputeMediaScores } from "@/lib/scoring/recompute";
import { mediaFormInputFromFormData } from "@/lib/validation";

export async function createMediaItem(formData: FormData) {
  const input = mediaFormInputFromFormData(formData);
  const media = await prisma.mediaItem.create({
    data: mediaMutationData(input),
  });
  await upsertTaxonomy(media.id, input.genres, input.tags);
  await recomputeMediaScores(media.id);
  revalidatePath("/media");
  redirect(`/media/${media.id}`);
}

export async function updateMediaItem(id: string, formData: FormData) {
  const input = mediaFormInputFromFormData(formData);
  await prisma.mediaItem.update({
    where: { id },
    data: mediaMutationData(input),
  });
  await upsertTaxonomy(id, input.genres, input.tags);
  await recomputeMediaScores(id);
  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
  redirect(`/media/${id}`);
}

export async function archiveMediaItem(id: string) {
  await prisma.mediaItem.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/media");
  redirect("/media");
}

export async function unarchiveMediaItem(id: string) {
  await prisma.mediaItem.update({ where: { id }, data: { isArchived: false } });
  revalidatePath("/media");
  redirect(`/media/${id}`);
}

export async function deleteMediaItem(id: string) {
  await prisma.mediaItem.delete({ where: { id } });
  revalidatePath("/media");
  redirect("/media");
}

export async function addNote(id: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (body) {
    await prisma.note.create({ data: { mediaId: id, body } });
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
