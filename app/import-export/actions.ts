"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  importJsonExport,
  importLetterboxdRows,
  importMediaRows,
  importMediaRowsWithSource,
  mapTabularMediaRows,
  parseLetterboxdBundleForImport,
  parseMediaCsvTabular,
  parseMediaXlsx,
  previewLetterboxdImport,
  previewMediaImport,
} from "@/lib/import-export";
import type { MediaImportMapping } from "@/lib/types";
import { requireUser } from "@/lib/user";

export async function importCsvFile(formData: FormData) {
  await requireUser("/import-export");
  const file = formData.get("file");
  if (!(file instanceof File)) return;
  const rows = mapTabularMediaRows(
    parseMediaCsvTabular(await file.text()),
    parseMapping(formData),
  );
  const preview = await previewMediaImport(rows);
  if (!preview.valid) {
    await prisma.importJob.create({
      data: {
        sourceType: "CSV",
        fileName: file.name,
        status: "FAILED",
        importedCount: 0,
        skippedCount: preview.errors.length,
        errorJson: JSON.stringify(preview.errors),
      },
    });
    revalidatePath("/import-export");
    return;
  }
  await importMediaRows(preview.rows, file.name);
  revalidatePath("/import-export");
  revalidatePath("/library");
}

export async function importXlsxFile(formData: FormData) {
  await requireUser("/import-export");
  const file = formData.get("file");
  if (!(file instanceof File)) return;
  const rows = mapTabularMediaRows(
    await parseMediaXlsx(await file.arrayBuffer()),
    parseMapping(formData),
  );
  const preview = await previewMediaImport(rows);
  if (!preview.valid) {
    await prisma.importJob.create({
      data: {
        sourceType: "XLSX",
        fileName: file.name,
        status: "FAILED",
        importedCount: 0,
        skippedCount: preview.errors.length,
        errorJson: JSON.stringify(preview.errors),
      },
    });
    revalidatePath("/import-export");
    return;
  }
  await importMediaRowsWithSource(preview.rows, "XLSX", file.name);
  revalidatePath("/import-export");
  revalidatePath("/library");
}

export async function importJsonFile(formData: FormData) {
  await requireUser("/import-export");
  const file = formData.get("file");
  if (!(file instanceof File)) return;
  await importJsonExport(JSON.parse(await file.text()), file.name);
  revalidatePath("/import-export");
  revalidatePath("/library");
}

export async function importLetterboxdBundleFiles(formData: FormData) {
  await requireUser("/import-export");
  const watchlist = formData.get("watchlist");
  const watched = formData.get("watched");
  const ratings = formData.get("ratings");
  const bundle = {
    watchlist: watchlist instanceof File ? await watchlist.text() : undefined,
    watched: watched instanceof File ? await watched.text() : undefined,
    ratings: ratings instanceof File ? await ratings.text() : undefined,
  };
  if (!bundle.watchlist && !bundle.watched && !bundle.ratings) return;

  const fileName = [watchlist, watched, ratings]
    .filter((entry): entry is File => entry instanceof File)
    .map((entry) => entry.name)
    .join(", ");

  const parsed = parseLetterboxdBundleForImport(bundle);
  const preview = await previewLetterboxdImport(parsed.rows, parsed.errors);
  if (!preview.valid) {
    await prisma.importJob.create({
      data: {
        sourceType: "CSV",
        fileName,
        status: "FAILED",
        importedCount: 0,
        skippedCount: preview.errors.length,
        errorJson: JSON.stringify(preview.errors),
      },
    });
    revalidatePath("/import-export");
    return;
  }
  await importLetterboxdRows(preview.rows, fileName);
  revalidatePath("/import-export");
  revalidatePath("/library");
  revalidatePath("/watchlist");
  revalidatePath("/dashboard");
}

function parseMapping(formData: FormData): MediaImportMapping | undefined {
  const raw = String(formData.get("mapping") ?? "");
  if (!raw) return undefined;
  return JSON.parse(raw) as MediaImportMapping;
}
