"use server";

import { revalidatePath } from "next/cache";
import { ReleaseCandidateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  importReleaseCandidate,
  setReleaseCandidateStatus,
} from "@/lib/release-candidates";

function revalidateUpcomingChange(id: string) {
  revalidatePath("/upcoming");
  revalidatePath("/dashboard");
  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
}

function revalidateCandidateChange() {
  revalidatePath("/upcoming");
  revalidatePath("/recommendations");
  revalidatePath("/dashboard");
  revalidatePath("/media");
}

export async function clearReleaseDate(id: string) {
  const item = await prisma.mediaItem.findUnique({
    where: { id },
    select: { releaseDate: true },
  });

  if (!item?.releaseDate) {
    return;
  }

  await prisma.mediaItem.update({
    where: { id },
    data: { releaseDate: null },
  });

  revalidateUpcomingChange(id);
}

export async function approveReleaseCandidate(id: string) {
  await setReleaseCandidateStatus(id, ReleaseCandidateStatus.APPROVED);
  revalidateCandidateChange();
}

export async function rejectReleaseCandidate(id: string) {
  await setReleaseCandidateStatus(id, ReleaseCandidateStatus.REJECTED);
  revalidateCandidateChange();
}

export async function ignoreReleaseCandidate(id: string) {
  await setReleaseCandidateStatus(id, ReleaseCandidateStatus.IGNORED);
  revalidateCandidateChange();
}

export async function importApprovedReleaseCandidate(id: string) {
  await importReleaseCandidate(id);
  revalidateCandidateChange();
}
