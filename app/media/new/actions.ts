"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { queueToast } from "@/lib/toast";
import {
  findExistingMediaItem,
  mediaMutationDataWithUniqueTitle,
  upsertMediaRelations,
} from "@/lib/media";
import { recomputeMediaScores } from "@/lib/scoring/recompute";
import { splitGenresAndTags } from "@/lib/taxonomy";
import {
  fetchProviderDetails,
  isSearchableMediaType,
  searchProviders,
  type ProviderCandidate,
  type ProviderSource,
} from "@/lib/metadata/providers";

/**
 * Search-and-add.
 *
 * "Add media" used to mean filling in fifteen fields — one of them a raw JSON
 * textarea — and then, for a non-admin, watching the item silently not appear
 * because the whole thing was routed to an admin review queue.
 *
 * Now the user types a title, picks it from a list, and we build the item from
 * the provider's metadata. The three outcomes:
 *
 *   1. It's already in the catalog  → don't duplicate it; go straight to it, so
 *      they can do the thing they actually came to do (mark it watched, rate it).
 *   2. Provider match, not in the DB → create it directly. The metadata comes
 *      from the same trusted sources the backfill bot already writes from, so
 *      "Create media" finally does what it says.
 *   3. No provider match             → fall through to the manual form, which
 *      still goes to admin review. Free-form invention stays gated.
 */

export async function searchMediaProviders(
  query: string,
  mediaType: string | null,
): Promise<ProviderCandidate[]> {
  await requireUser();
  const type = isSearchableMediaType(mediaType) ? mediaType : null;
  return searchProviders(query, type);
}

export async function addMediaFromProvider(formData: FormData) {
  const user = await requireUser();

  const source = String(formData.get("source") ?? "") as ProviderSource;
  const sourceId = String(formData.get("sourceId") ?? "");
  const rawType = String(formData.get("mediaType") ?? "");

  if (
    (source !== "tmdb" && source !== "rawg") ||
    !sourceId ||
    !isSearchableMediaType(rawType)
  ) {
    await queueToast("Couldn't add that title.", "error");
    return;
  }
  const mediaType: MediaType = rawType;

  const details = await fetchProviderDetails(source, sourceId, mediaType);
  if (!details) {
    await queueToast(
      "Couldn't fetch details for that title. Try adding it manually.",
      "error",
    );
    return;
  }

  // Genres and tags arrive mixed together from the providers; the taxonomy
  // module knows which names are canonical genres for this type and which
  // should become tags.
  const { genres, tags } = splitGenresAndTags(mediaType, [
    ...details.genres,
    ...details.tags,
  ]);

  const input = {
    title: details.title,
    mediaType,
    description: details.description ?? "",
    releaseDate: details.releaseDate ?? null,
    externalUrl: details.externalUrl ?? "",
    genres,
    tags,
    credits: details.credits,
  };

  // Already in the catalog? Don't create a second copy — send them to it. This
  // is the common case and it's what they wanted anyway.
  const existing = await findExistingMediaItem(prisma, input);
  if (existing) {
    await queueToast(`${existing.title} is already here.`);
    redirect(`/media/${existing.id}`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const data = await mediaMutationDataWithUniqueTitle(tx, input);
    const item = await tx.mediaItem.create({
      data: {
        ...data,
        posterUrl: details.posterUrl,
        platformsJson:
          details.platforms.length > 0
            ? JSON.stringify(details.platforms)
            : null,
        // Provenance: this is how the admin "Recently added by users" list
        // tells real user additions apart from seeded/backfilled entries.
        createdById: user.id,
      },
    });
    // Put it in their library straight away — they're adding it because they
    // want to track it.
    await tx.userMedia.create({ data: { userId: user.id, mediaId: item.id } });
    return item;
  });

  await upsertMediaRelations(created.id, { ...input, mediaType });
  await recomputeMediaScores(created.id, user.id);

  revalidatePath("/library");
  revalidatePath("/admin");
  await queueToast(`${created.title} added.`);
  redirect(`/media/${created.id}`);
}
