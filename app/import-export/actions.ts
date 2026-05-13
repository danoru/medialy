"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  importJsonExport,
  importLetterboxdRows,
  importMediaRows,
  importMediaRowsWithSource,
  mapTabularMediaRows,
  parseLetterboxdRowsForImport,
  parseMediaCsvTabular,
  parseMediaXlsx,
  previewLetterboxdImport,
  previewMediaImport,
} from "@/lib/import-export";
import type { LetterboxdImportRole, MediaImportMapping } from "@/lib/types";

export async function importCsvFile(formData: FormData) {
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
  revalidatePath("/media");
}

export async function importXlsxFile(formData: FormData) {
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
  revalidatePath("/media");
}

export async function importJsonFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return;
  await importJsonExport(JSON.parse(await file.text()), file.name);
  revalidatePath("/import-export");
  revalidatePath("/media");
}

export async function importLetterboxdCsvFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return;
  const role = parseLetterboxdRole(formData);
  const parsed = parseLetterboxdRowsForImport(
    parseMediaCsvTabular(await file.text()),
    role,
  );
  const preview = await previewLetterboxdImport(parsed.rows, parsed.errors);
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
  await importLetterboxdRows(preview.rows, file.name);
  revalidatePath("/import-export");
  revalidatePath("/media");
  revalidatePath("/watchlist");
  revalidatePath("/dashboard");
}

function parseMapping(formData: FormData): MediaImportMapping | undefined {
  const raw = String(formData.get("mapping") ?? "");
  if (!raw) return undefined;
  return JSON.parse(raw) as MediaImportMapping;
}

function parseLetterboxdRole(formData: FormData): LetterboxdImportRole {
  const raw = String(formData.get("letterboxdRole") ?? "watchlist");
  return raw === "watched" ? "watched" : "watchlist";
}
