import { NextResponse } from "next/server";
import {
  mapTabularMediaRows,
  parseLetterboxdBundleForImport,
  parseMediaCsvTabular,
  parseMediaXlsx,
  previewLetterboxdImport,
  previewMediaImport,
  suggestMediaImportMapping,
} from "@/lib/import-export";
import { prisma } from "@/lib/prisma";
import type {
  MediaImportMapping,
  MedialyExport,
  TabularMediaRows,
} from "@/lib/types";
import { getCurrentUser } from "@/lib/user";
import {
  assertExportVersion,
  mediaFormInputFromCsvRow,
  normalizeKey,
} from "@/lib/validation";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formData = await request.formData();
  const file = formData.get("file");
  const type = String(formData.get("type") ?? "");

  if (type !== "letterboxd-bundle" && !(file instanceof File)) {
    return NextResponse.json(
      { valid: false, errors: [{ message: "File is required." }] },
      { status: 400 },
    );
  }

  try {
    if ((type === "csv" || type === "xlsx") && file instanceof File) {
      const tabular =
        type === "csv"
          ? parseMediaCsvTabular(await file.text())
          : await parseMediaXlsx(await file.arrayBuffer());
      const mapping = parseMapping(formData, tabular);
      const rows = mapTabularMediaRows(tabular, mapping);
      const preview = await previewMediaImport(rows);

      return NextResponse.json({
        type,
        valid: preview.valid,
        creates: preview.creates,
        updates: preview.updates,
        errors: preview.errors,
        totalRows: rows.length,
        headers: tabular.headers,
        mapping,
        samples: tabular.rows.slice(0, 3),
      });
    }

    if (type === "letterboxd-bundle") {
      const watchlist = formData.get("watchlist");
      const watched = formData.get("watched");
      const ratings = formData.get("ratings");
      const bundle = {
        watchlist:
          watchlist instanceof File ? await watchlist.text() : undefined,
        watched: watched instanceof File ? await watched.text() : undefined,
        ratings: ratings instanceof File ? await ratings.text() : undefined,
      };
      const parsed = parseLetterboxdBundleForImport(bundle);
      const preview = await previewLetterboxdImport(parsed.rows, parsed.errors);

      return NextResponse.json({
        type,
        valid: preview.valid,
        creates: preview.creates,
        updates: preview.updates,
        errors: preview.errors,
        totalRows: parsed.rows.length + parsed.errors.length,
      });
    }

    if (type === "json" && file instanceof File) {
      const parsed = JSON.parse(await file.text()) as MedialyExport;
      assertExportVersion(parsed);
      const media = Array.isArray(parsed.media) ? parsed.media : [];
      const existing = await prisma.mediaItem.findMany({
        select: { title: true, mediaType: true },
      });
      const existingKeys = new Set(
        existing.map((item) => normalizeKey(item.title, item.mediaType)),
      );
      let creates = 0;
      let updates = 0;
      const errors: Array<{ row: number; message: string }> = [];

      media.forEach((raw, index) => {
        const item = raw as {
          title?: string;
          mediaType?: string;
          status?: string;
          releaseDate?: string | Date | null;
          personalRating?: number | null;
        };

        try {
          const input = mediaFormInputFromCsvRow({
            title: item.title ?? "",
            mediaType: item.mediaType ?? "",
            status: item.status ?? "UNTRACKED",
            releaseDate: item.releaseDate
              ? String(item.releaseDate).slice(0, 10)
              : "",
            personalRating:
              item.personalRating == null ? "" : String(item.personalRating),
          });
          if (existingKeys.has(normalizeKey(input.title, input.mediaType)))
            updates += 1;
          else creates += 1;
        } catch (error) {
          errors.push({
            row: index + 1,
            message:
              error instanceof Error ? error.message : "Invalid media item.",
          });
        }
      });

      return NextResponse.json({
        type: "json",
        valid: errors.length === 0,
        creates,
        updates,
        errors,
        totalRows: media.length,
        exportedAt: parsed.exportedAt,
      });
    }

    return NextResponse.json(
      { valid: false, errors: [{ message: "Unknown import type." }] },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        errors: [
          {
            message: error instanceof Error ? error.message : "Preview failed.",
          },
        ],
      },
      { status: 400 },
    );
  }
}

function parseMapping(
  formData: FormData,
  tabular: TabularMediaRows,
): MediaImportMapping {
  const raw = String(formData.get("mapping") ?? "");
  if (!raw) return suggestMediaImportMapping(tabular.headers);
  return JSON.parse(raw) as MediaImportMapping;
}

