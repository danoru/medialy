"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function approveTag(id: string) {
  await prisma.tag.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  revalidatePath("/settings");
  revalidatePath("/media/new");
}

export async function rejectTag(id: string) {
  await prisma.tag.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  revalidatePath("/settings");
  revalidatePath("/media/new");
}
