import { buildMediaCsvExport } from "@/lib/import-export";

export async function GET() {
  return new Response(await buildMediaCsvExport(), {
    headers: {
      "Content-Disposition": `attachment; filename="media.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
