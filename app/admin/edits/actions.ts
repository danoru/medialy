"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  findExistingMediaItem,
  mediaMutationDataWithUniqueTitle,
  replaceManualExternalRatings,
  replaceMediaConnections,
  upsertMediaRelations,
} from "@/lib/media";
import type { ExternalRatingSource } from "@prisma/client";
import {
  recomputeConsensusScore,
  recomputeMediaScores,
} from "@/lib/scoring/recompute";
import { requireAdmin } from "@/lib/user";
import { queueToast } from "@/lib/toast";
import type {
  MediaFormInput,
  MediaRelationInput,
  MediaReleaseEventInput,
} from "@/lib/types";
import type { EditSuggestionSnapshot } from "@/lib/edit-suggestions";

function snapshotToFormInput(snapshot: EditSuggestionSnapshot): MediaFormInput {
  return {
    title: snapshot.title,
    originalTitle: snapshot.originalTitle,
    mediaType: snapshot.mediaType as MediaFormInput["mediaType"],
    description: snapshot.description,
    releaseDate: snapshot.releaseDate ? new Date(snapshot.releaseDate) : null,
    externalUrl: snapshot.externalUrl,
    metadataJson: snapshot.metadataJson,
    // No per-user fields: a suggestion is shared-catalog data. Approving one
    // must never touch anybody's rating, status, or favorites.
    genres: snapshot.genres,
    tags: snapshot.tags,
    credits: snapshot.credits.map((credit) => ({
      role: credit.role as NonNullable<MediaFormInput["credits"]>[number]["role"],
      kind: credit.kind as NonNullable<MediaFormInput["credits"]>[number]["kind"],
      names: credit.names,
    })),
    externalRatings: snapshot.externalRatings.map((rating) => ({
      source: rating.source as ExternalRatingSource,
      score: rating.score,
      scale: rating.scale,
    })),
    // Older suggestions predate connections being part of the form. `undefined`
    // there means "don't touch them", which is the right call — an old
    // suggestion never intended to clear an item's links.
    relations: snapshot.relations?.map((relation) => ({
      kind: relation.kind as MediaRelationInput["kind"],
      direction: relation.direction,
      otherId: relation.otherId,
      otherTitle: relation.otherTitle,
    })),
    releaseEvents: snapshot.releaseEvents?.map((event) => ({
      kind: event.kind as MediaReleaseEventInput["kind"],
      date: event.date,
      title: event.title,
    })),
  };
}

function revalidateAfterReview() {
  revalidatePath("/admin/edits");
  revalidatePath("/admin");
  revalidatePath("/library");
}

export async function approveMediaEditSuggestion(id: string) {
  const admin = await requireAdmin("/admin/edits");
  const suggestion = await prisma.mediaEditSuggestion.findUnique({
    where: { id },
  });
  if (!suggestion || suggestion.status !== "PENDING") return;

  const snapshot = JSON.parse(
    suggestion.afterJson,
  ) as EditSuggestionSnapshot;
  const input = snapshotToFormInput(snapshot);

  if (suggestion.mediaId) {
    const mediaId = suggestion.mediaId;
    const conflicted = await prisma.$transaction(async (tx) => {
      const existing = await findExistingMediaItem(tx, input, mediaId);
      if (existing) return true;
      const data = await mediaMutationDataWithUniqueTitle(tx, input, mediaId);
      await tx.mediaItem.update({ where: { id: mediaId }, data });
      return false;
    });

    if (conflicted) {
      await queueToast(
        "Cannot apply: another item already uses that title.",
        "error",
      );
      return;
    }

    await upsertMediaRelations(mediaId, input);
    await replaceMediaConnections(mediaId, input);
    await replaceManualExternalRatings(mediaId, input);
    await recomputeConsensusScore(mediaId);
  } else {
    // Addition: create the MediaItem; attach UserMedia to the proposing user
    // so it lands in their library.
    const created = await prisma.$transaction(async (tx) => {
      const existing = await findExistingMediaItem(tx, input);
      if (existing) return null;
      const data = await mediaMutationDataWithUniqueTitle(tx, input);
      const item = await tx.mediaItem.create({ data });
      await tx.userMedia.create({
        data: { userId: suggestion.userId, mediaId: item.id },
      });
      return item;
    });

    if (!created) {
      await queueToast(
        "Cannot apply: a matching media item already exists.",
        "error",
      );
      return;
    }

    await upsertMediaRelations(created.id, input);
    await replaceMediaConnections(created.id, input);
    await replaceManualExternalRatings(created.id, input);
    await recomputeMediaScores(created.id, suggestion.userId);
  }

  await prisma.mediaEditSuggestion.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedById: admin.id,
    },
  });
  revalidateAfterReview();
}

export async function rejectMediaEditSuggestion(id: string) {
  const admin = await requireAdmin("/admin/edits");
  await prisma.mediaEditSuggestion.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: admin.id,
    },
  });
  revalidateAfterReview();
}
