"use server";

import { revalidatePath } from "next/cache";
import { MediaType, TagCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeTagKey, normalizeTagName } from "@/lib/taxonomy";
import { requireAdmin } from "@/lib/user";

const mediaTypes = new Set<string>(Object.values(MediaType));
const tagCategories = new Set<string>(Object.values(TagCategory));

export async function approveTag(id: string, formData: FormData) {
  await requireAdmin("/admin/tags");
  const category = String(formData.get("category") ?? "THEME").toUpperCase();
  const mediaTypesJson = selectedMediaTypes(formData);
  const countryCode = String(formData.get("countryCode") ?? "")
    .trim()
    .toUpperCase();
  const name = normalizeTagName(String(formData.get("name") ?? ""));

  await prisma.tag.update({
    where: { id },
    data: {
      ...(name
        ? {
            name,
            normalizedName: normalizeTagKey(name),
          }
        : {}),
      status: "APPROVED",
      category: tagCategories.has(category)
        ? (category as TagCategory)
        : "THEME",
      discoverable: formData.get("discoverable") === "on",
      mediaTypesJson,
      countryCode: countryCode || null,
      approvedAt: new Date(),
    },
  });
  revalidatePath("/admin/tags");
  revalidatePath("/media/new");
  revalidatePath("/media");
}

export async function rejectTag(id: string) {
  await requireAdmin("/admin/tags");
  await prisma.tag.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  revalidatePath("/admin/tags");
  revalidatePath("/media/new");
}

function selectedMediaTypes(formData: FormData) {
  const selected = formData
    .getAll("mediaTypes")
    .map((value) => String(value).toUpperCase())
    .filter((value): value is MediaType => mediaTypes.has(value));

  return selected.length > 0 ? JSON.stringify(selected) : null;
}
