import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import {
  importCsvFile,
  importJsonFile,
  importLetterboxdCsvFile,
  importXlsxFile,
} from "@/app/import-export/actions";
import { ImportExportPanel } from "@/components/import-export/ImportExportPanel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ImportExportPage() {
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <Stack spacing={3}>
      <Box>
        <Typography component="h1" sx={{ fontWeight: 700 }} variant="h4">
          Import / Export
        </Typography>
        <Typography color="text.secondary">
          Local JSON, CSV, and XLSX workflows. JSON is the full-fidelity format.
        </Typography>
      </Box>
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
              <Typography color="text.secondary">
                No imports recorded yet.
              </Typography>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
