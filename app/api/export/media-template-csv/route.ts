import { buildMediaImportTemplateCsv } from "@/lib/import-export";

export async function GET() {
  return new Response(buildMediaImportTemplateCsv(), {
    headers: {
      "Content-Disposition": `attachment; filename="medialy-media-import-template.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
