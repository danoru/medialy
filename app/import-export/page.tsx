import { Card, CardContent, Stack, Typography } from "@mui/material";
import {
  importCsvFile,
  importJsonFile,
  importLetterboxdCsvFile,
  importXlsxFile,
} from "@/app/import-export/actions";
import { ImportExportPanel } from "@/components/import-export/ImportExportPanel";
import { StatePanel } from "@/components/shared/StatePanel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import / Export" };

export default async function ImportExportPage() {
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <Stack spacing={3}>
      <ImportExportPanel
        importCsvFile={importCsvFile}
        importJsonFile={importJsonFile}
        importLetterboxdCsvFile={importLetterboxdCsvFile}
        importXlsxFile={importXlsxFile}
      />
      <Card variant="outlined">
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
            Recent Import Jobs
          </Typography>
          <Stack spacing={1}>
            {jobs.map((job) => (
              <Typography key={job.id}>
                {job.createdAt.toLocaleString()}: {job.sourceType} {job.status},{" "}
                {job.importedCount} imported, {job.skippedCount} skipped
              </Typography>
            ))}
            {jobs.length === 0 ? (
              <StatePanel
                description="Validated imports will appear here after a JSON, CSV, XLSX, or Letterboxd file is imported."
                minHeight={160}
                title="No imports recorded yet"
              />
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
