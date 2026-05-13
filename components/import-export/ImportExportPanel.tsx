"use client";

import { useRef, useState, useTransition } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Stack,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import {
  MEDIA_IMPORT_ADVANCED_FIELDS,
  MEDIA_IMPORT_CORE_FIELDS,
  MEDIA_IMPORT_FIELDS,
} from "@/lib/import-export";
import type { MediaImportField, MediaImportMapping } from "@/lib/types";

type ImportType = "csv" | "json" | "xlsx" | "letterboxd";
type LetterboxdRole = "watchlist" | "watched";

type Preview = {
  type: ImportType;
  valid: boolean;
  creates: number;
  updates: number;
  totalRows: number;
  exportedAt?: string;
  headers?: string[];
  mapping?: MediaImportMapping;
  errors: Array<{ row?: number; message: string }>;
};

const fieldMeta = new Map(
  MEDIA_IMPORT_FIELDS.map((field) => [field.key, field]),
);

export function ImportExportPanel({
  importCsvFile,
  importJsonFile,
  importLetterboxdCsvFile,
  importXlsxFile,
}: {
  importCsvFile: (formData: FormData) => void | Promise<void>;
  importJsonFile: (formData: FormData) => void | Promise<void>;
  importLetterboxdCsvFile: (formData: FormData) => void | Promise<void>;
  importXlsxFile: (formData: FormData) => void | Promise<void>;
}) {
  const csvFormRef = useRef<HTMLFormElement>(null);
  const jsonFormRef = useRef<HTMLFormElement>(null);
  const letterboxdWatchlistFormRef = useRef<HTMLFormElement>(null);
  const letterboxdWatchedFormRef = useRef<HTMLFormElement>(null);
  const xlsxFormRef = useRef<HTMLFormElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<ImportType | null>(null);
  const [activeLetterboxdRole, setActiveLetterboxdRole] =
    useState<LetterboxdRole>("watchlist");
  const [mapping, setMapping] = useState<MediaImportMapping>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function previewFile(
    file: File | undefined,
    type: ImportType,
    nextMapping?: MediaImportMapping,
    letterboxdRole: LetterboxdRole = "watchlist",
  ) {
    setActiveType(type);
    setActiveLetterboxdRole(letterboxdRole);
    setSelectedFile(file ?? null);
    setPreview(null);
    setPreviewError(null);

    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);
    formData.set("type", type);
    if (nextMapping) formData.set("mapping", JSON.stringify(nextMapping));
    if (type === "letterboxd") formData.set("letterboxdRole", letterboxdRole);

    const response = await fetch("/api/import/preview", {
      method: "POST",
      body: formData,
    });
    const body = (await response.json()) as
      | Preview
      | { errors?: Array<{ message: string }> };

    if (!response.ok || !("valid" in body)) {
      setPreviewError(body.errors?.[0]?.message ?? "Preview failed.");
      return;
    }

    if (body.mapping) setMapping(body.mapping);
    setPreview(body);
  }

  function updateMapping(
    field: MediaImportField,
    event: SelectChangeEvent<string>,
  ) {
    if (!selectedFile || !activeType || activeType === "json") return;
    const nextMapping = { ...mapping, [field]: event.target.value };
    setMapping(nextMapping);
    void previewFile(selectedFile, activeType, nextMapping);
  }

  function submitPreviewedImport() {
    if (!preview?.valid || !activeType) return;
    const form =
      activeType === "csv"
        ? csvFormRef.current
        : activeType === "xlsx"
          ? xlsxFormRef.current
          : activeType === "letterboxd" && activeLetterboxdRole === "watchlist"
            ? letterboxdWatchlistFormRef.current
            : activeType === "letterboxd"
              ? letterboxdWatchedFormRef.current
              : jsonFormRef.current;
    if (!form) return;

    startTransition(() => {
      form.requestSubmit();
    });
  }

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 5 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
              Export
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", gap: 1 }}
            >
              <Button
                href="/api/export/json"
                startIcon={<DownloadIcon />}
                variant="contained"
              >
                JSON
              </Button>
              <Button
                href="/api/export/media-csv"
                startIcon={<DownloadIcon />}
                variant="outlined"
              >
                media.csv
              </Button>
              <Button
                href="/api/export/media-template-csv"
                startIcon={<DownloadIcon />}
                variant="outlined"
              >
                CSV template
              </Button>
              <Button
                href="/api/export/media-template-xlsx"
                startIcon={<DownloadIcon />}
                variant="outlined"
              >
                XLSX template
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 7 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
              Import Wizard
            </Typography>
            <Stack spacing={2}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", gap: 1 }}
              >
                <ImportFileForm
                  accept="application/json,.json"
                  action={importJsonFile}
                  buttonLabel="JSON file"
                  formRef={jsonFormRef}
                  onFile={(file) => previewFile(file, "json")}
                />
                <ImportFileForm
                  accept="text/csv,.csv"
                  action={importCsvFile}
                  buttonLabel="CSV file"
                  formRef={csvFormRef}
                  mapping={mapping}
                  onFile={(file) => previewFile(file, "csv")}
                />
                <ImportFileForm
                  accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                  action={importXlsxFile}
                  buttonLabel="XLSX file"
                  formRef={xlsxFormRef}
                  mapping={mapping}
                  onFile={(file) => previewFile(file, "xlsx")}
                />
                <ImportFileForm
                  accept="text/csv,.csv"
                  action={importLetterboxdCsvFile}
                  buttonLabel="Letterboxd watchlist"
                  formRef={letterboxdWatchlistFormRef}
                  letterboxdRole="watchlist"
                  onFile={(file) =>
                    previewFile(file, "letterboxd", undefined, "watchlist")
                  }
                />
                <ImportFileForm
                  accept="text/csv,.csv"
                  action={importLetterboxdCsvFile}
                  buttonLabel="Letterboxd watched"
                  formRef={letterboxdWatchedFormRef}
                  letterboxdRole="watched"
                  onFile={(file) =>
                    previewFile(file, "letterboxd", undefined, "watched")
                  }
                />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Switch
                  checked={showAdvanced}
                  onChange={(event) => setShowAdvanced(event.target.checked)}
                />
                <Typography variant="body2" color="text.secondary">
                  Show advanced fields
                </Typography>
              </Stack>
              <MappingWizard
                mapping={mapping}
                onChange={updateMapping}
                preview={preview}
                showAdvanced={showAdvanced}
              />
              <PreviewCard
                isPending={isPending}
                onConfirm={submitPreviewedImport}
                preview={preview}
                previewError={previewError}
              />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function ImportFileForm({
  accept,
  action,
  buttonLabel,
  formRef,
  mapping,
  letterboxdRole,
  onFile,
}: {
  accept: string;
  action: (formData: FormData) => void | Promise<void>;
  buttonLabel: string;
  formRef: React.RefObject<HTMLFormElement | null>;
  letterboxdRole?: LetterboxdRole;
  mapping?: MediaImportMapping;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <form action={action} ref={formRef}>
      {mapping ? (
        <input name="mapping" type="hidden" value={JSON.stringify(mapping)} />
      ) : null}
      {letterboxdRole ? (
        <input name="letterboxdRole" type="hidden" value={letterboxdRole} />
      ) : null}
      <Button
        component="label"
        startIcon={<UploadFileIcon />}
        variant="outlined"
      >
        {buttonLabel}
        <input
          accept={accept}
          hidden
          name="file"
          onChange={(event) => onFile(event.currentTarget.files?.[0])}
          required
          type="file"
        />
      </Button>
    </form>
  );
}

function MappingWizard({
  mapping,
  onChange,
  preview,
  showAdvanced,
}: {
  mapping: MediaImportMapping;
  onChange: (field: MediaImportField, event: SelectChangeEvent<string>) => void;
  preview: Preview | null;
  showAdvanced: boolean;
}) {
  if (
    !preview?.headers?.length ||
    preview.type === "json" ||
    preview.type === "letterboxd"
  )
    return null;
  const headers = preview.headers;
  const visibleFields = [
    ...MEDIA_IMPORT_CORE_FIELDS,
    ...(showAdvanced ? MEDIA_IMPORT_ADVANCED_FIELDS : []),
  ]
    .map((key) => fieldMeta.get(key))
    .filter((field): field is NonNullable<typeof field> => Boolean(field));

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
      <Stack spacing={2}>
        <Typography sx={{ fontWeight: 700 }} variant="subtitle1">
          Field mapping
        </Typography>
        <Grid container spacing={1.5}>
          {visibleFields.map((field) => (
            <Grid key={field.key} size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {field.required ? `${field.label} *` : field.label}
                </InputLabel>
                <Select
                  label={field.required ? `${field.label} *` : field.label}
                  onChange={(event) => onChange(field.key, event)}
                  value={mapping[field.key] ?? ""}
                >
                  <MenuItem value="">
                    <em>Unmapped</em>
                  </MenuItem>
                  {headers.map((header) => (
                    <MenuItem key={header} value={header}>
                      {header}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          ))}
        </Grid>
        {!showAdvanced ? (
          <Typography color="text.secondary" variant="body2">
            Advanced fields like original title, release dates, genres, tags,
            and external URLs stay hidden until you need them.
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

function PreviewCard({
  isPending,
  onConfirm,
  preview,
  previewError,
}: {
  isPending: boolean;
  onConfirm: () => void;
  preview: Preview | null;
  previewError: string | null;
}) {
  if (previewError) {
    return <Alert severity="error">{previewError}</Alert>;
  }

  if (!preview) {
    return (
      <Alert severity="info">
        Choose a local JSON, CSV, XLSX, or Letterboxd CSV file to validate it
        before importing.
      </Alert>
    );
  }

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          <Chip label={preview.type.toUpperCase()} />
          <Chip label={`${preview.totalRows} rows`} variant="outlined" />
          <Chip
            color="success"
            label={`${preview.creates} creates`}
            variant="outlined"
          />
          <Chip
            color="info"
            label={`${preview.updates} updates`}
            variant="outlined"
          />
          <Chip
            color={preview.errors.length > 0 ? "error" : "success"}
            label={`${preview.errors.length} errors`}
            variant="outlined"
          />
        </Stack>
        {preview.exportedAt ? (
          <Typography color="text.secondary" variant="body2">
            Exported at {new Date(preview.exportedAt).toLocaleString()}
          </Typography>
        ) : null}
        <Divider />
        {preview.errors.length > 0 ? (
          <Stack spacing={0.5}>
            {preview.errors.slice(0, 5).map((error, index) => (
              <Typography
                color="error"
                key={`${error.row ?? index}-${error.message}`}
                variant="body2"
              >
                {error.row ? `Row ${error.row}: ` : ""}
                {error.message}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary" variant="body2">
            Preview passed. Import will update existing matches and create
            missing items.
          </Typography>
        )}
        <Button
          disabled={!preview.valid || isPending}
          onClick={onConfirm}
          variant="contained"
        >
          {isPending ? "Importing..." : "Confirm import"}
        </Button>
      </Stack>
    </Box>
  );
}
