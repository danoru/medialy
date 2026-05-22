"use server";

import { revalidatePath } from "next/cache";
import { ReleaseCandidateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  importReleaseCandidate,
  setReleaseCandidateStatus,
} from "@/lib/release-candidates";
import { requireAdmin } from "@/lib/user";

function revalidateUpcomingChange(id: string) {
  revalidatePath("/upcoming");
  revalidatePath("/dashboard");
  revalidatePath("/library");
  revalidatePath(`/media/${id}`);
}

function revalidateCandidateChange() {
  revalidatePath("/admin/candidates");
  revalidatePath("/recommendations");
  revalidatePath("/dashboard");
  revalidatePath("/library");
}

export async function clearReleaseDate(id: string) {
  await requireAdmin("/upcoming");
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
  await requireAdmin("/admin/candidates");
  await setReleaseCandidateStatus(id, ReleaseCandidateStatus.APPROVED);
  revalidateCandidateChange();
}

export async function rejectReleaseCandidate(id: string) {
  await requireAdmin("/admin/candidates");
  await setReleaseCandidateStatus(id, ReleaseCandidateStatus.REJECTED);
  revalidateCandidateChange();
}

export async function ignoreReleaseCandidate(id: string) {
  await requireAdmin("/admin/candidates");
  await setReleaseCandidateStatus(id, ReleaseCandidateStatus.IGNORED);
  revalidateCandidateChange();
}

export async function importApprovedReleaseCandidate(id: string) {
  await requireAdmin("/admin/candidates");
  await importReleaseCandidate(id);
  revalidateCandidateChange();
}
