import { buildMediaImportTemplateXlsx } from "@/lib/import-export";

export async function GET() {
  const workbook = await buildMediaImportTemplateXlsx();
  const body = workbook.buffer.slice(
    workbook.byteOffset,
    workbook.byteOffset + workbook.byteLength,
  ) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Disposition": `attachment; filename="medialy-media-import-template.xlsx"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
