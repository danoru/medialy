import { buildJsonExport } from "@/lib/import-export";

export async function GET() {
  return Response.json(await buildJsonExport(), {
    headers: {
      "Content-Disposition": `attachment; filename="medialy-export.json"`,
    },
  });
}
