"use client";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Autocomplete,
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useRef, useState, useTransition } from "react";
import type { MediaType } from "@prisma/client";
import { PosterThumb } from "@/components/media/PosterCard";
import { formatMediaType } from "@/lib/format";
import type {
  CollectionItem,
  CollectionSection,
  CollectionSectionGroup,
} from "@/lib/db/collections";
import {
  addCollectionItem,
  addSection,
  clearFeaturedMonth,
  deleteSection,
  removeCollectionItem,
  searchMediaForCollection,
  setFeaturedMonth,
  updateCollectionItem,
  updateSection,
} from "@/app/discover/collections/actions";

type SearchOption = { id: string; title: string; mediaType: MediaType };

export function CollectionEditor({
  listId,
  featuredMonth,
  sections,
  ungrouped,
  sectionGroups,
}: {
  listId: string;
  featuredMonth: string | null;
  sections: CollectionSection[];
  ungrouped: CollectionItem[];
  sectionGroups: CollectionSectionGroup[];
}) {
  return (
    <Stack spacing={3}>
      <FeaturedMonthControl featuredMonth={featuredMonth} listId={listId} />
      <Divider />
      <SectionsManager listId={listId} sections={sections} />
      <Divider />
      <AddItemForm listId={listId} sections={sections} />
      <Divider />
      <ItemsList
        listId={listId}
        sectionGroups={sectionGroups}
        sections={sections}
        ungrouped={ungrouped}
      />
    </Stack>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <Typography variant="eyebrow">{children}</Typography>;
}

function FeaturedMonthControl({
  featuredMonth,
  listId,
}: {
  featuredMonth: string | null;
  listId: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <Stack spacing={1.5}>
      <SectionHeading>Monthly feature</SectionHeading>
      <Typography color="text.secondary" variant="body2">
        {featuredMonth
          ? `Featured for ${featuredMonth}. Setting a month publishes this collection.`
          : "Feature this collection as the monthly theme. Only one collection can hold a given month."}
      </Typography>
      <Box
        action={setFeaturedMonth.bind(null, listId)}
        component="form"
        sx={addFormSx}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" } }}
        >
          <TextField
            defaultValue={featuredMonth ?? ""}
            label="Month"
            name="month"
            required
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            type="month"
          />
          <Button size="small" type="submit" variant="contained">
            Set as featured
          </Button>
          {featuredMonth ? (
            <Button
              color="inherit"
              disabled={isPending}
              onClick={() =>
                startTransition(() => clearFeaturedMonth(listId))
              }
              size="small"
              type="button"
            >
              Clear
            </Button>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
}

function SectionsManager({
  listId,
  sections,
}: {
  listId: string;
  sections: CollectionSection[];
}) {
  const [isPending, startTransition] = useTransition();
  const addRef = useRef<HTMLFormElement>(null);
  return (
    <Stack spacing={1.5}>
      <SectionHeading>Sub-categories</SectionHeading>
      {sections.length > 0 ? (
        <Stack spacing={1}>
          {sections.map((section) => (
            <Box
              action={updateSection.bind(null, section.id, listId)}
              component="form"
              key={section.id}
              sx={rowFormSx}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ alignItems: { sm: "center" } }}
              >
                <TextField
                  defaultValue={section.title}
                  label="Title"
                  name="title"
                  required
                  size="small"
                  sx={{ minWidth: 160 }}
                />
                <TextField
                  defaultValue={section.description ?? ""}
                  label="Description"
                  name="description"
                  size="small"
                  sx={{ flex: 1, minWidth: 200 }}
                />
                <Button size="small" type="submit" variant="outlined">
                  Save
                </Button>
                <IconButton
                  aria-label="Delete section"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => deleteSection(section.id, listId))
                  }
                  size="small"
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2">
          No sub-categories yet. Items without one appear at the top.
        </Typography>
      )}
      <Box
        action={(formData: FormData) => {
          addSection(listId, formData);
          addRef.current?.reset();
        }}
        component="form"
        ref={addRef}
        sx={addFormSx}
      >
        <Typography sx={addFormCaptionSx} variant="labelMd">
          Add a sub-category
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" } }}
        >
          <TextField
            label="Title"
            name="title"
            required
            size="small"
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="Description (optional)"
            name="description"
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button size="small" type="submit" variant="contained">
            Add
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}

function AddItemForm({
  listId,
  sections,
}: {
  listId: string;
  sections: CollectionSection[];
}) {
  const [target, setTarget] = useState<SearchOption | null>(null);
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startSearch] = useTransition();
  const noteRef = useRef<HTMLFormElement>(null);

  const onSearch = (value: string) => {
    if (value.trim().length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    startSearch(async () => {
      const found = await searchMediaForCollection(value);
      setOptions(found);
      setLoading(false);
    });
  };

  return (
    <Stack spacing={1.5}>
      <SectionHeading>Add a title</SectionHeading>
      <Box
        action={(formData: FormData) => {
          if (!target) return;
          formData.set("mediaId", target.id);
          addCollectionItem(listId, formData);
          setTarget(null);
          setOptions([]);
          noteRef.current?.reset();
        }}
        component="form"
        ref={noteRef}
        sx={addFormSx}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          sx={{ alignItems: { md: "center" } }}
        >
          <Autocomplete
            filterOptions={(opts) => opts}
            getOptionLabel={(option) =>
              `${option.title} (${formatMediaType(option.mediaType)})`
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={loading}
            onChange={(_, value) => setTarget(value)}
            onInputChange={(_, value) => onSearch(value)}
            options={options}
            renderInput={(params) => (
              <TextField {...params} label="Search titles" />
            )}
            size="small"
            sx={{ flex: 1, minWidth: 220 }}
            value={target}
          />
          <SectionSelect name="sectionId" sections={sections} />
          <TextField
            label="Note (optional)"
            name="note"
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button
            disabled={!target}
            size="small"
            type="submit"
            variant="contained"
          >
            Add
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}

function ItemsList({
  listId,
  sections,
  ungrouped,
  sectionGroups,
}: {
  listId: string;
  sections: CollectionSection[];
  ungrouped: CollectionItem[];
  sectionGroups: CollectionSectionGroup[];
}) {
  const hasItems =
    ungrouped.length > 0 || sectionGroups.some((group) => group.items.length > 0);
  return (
    <Stack spacing={2}>
      <SectionHeading>Items</SectionHeading>
      {hasItems ? (
        <Stack spacing={2}>
          {ungrouped.length > 0 ? (
            <ItemGroup
              items={ungrouped}
              listId={listId}
              sections={sections}
              title="Ungrouped"
            />
          ) : null}
          {sectionGroups.map((group) => (
            <ItemGroup
              items={group.items}
              key={group.section.id}
              listId={listId}
              sections={sections}
              title={group.section.title}
            />
          ))}
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2">
          No titles yet. Search above to add some.
        </Typography>
      )}
    </Stack>
  );
}

function ItemGroup({
  items,
  listId,
  sections,
  title,
}: {
  items: CollectionItem[];
  listId: string;
  sections: CollectionSection[];
  title: string;
}) {
  if (items.length === 0) return null;
  return (
    <Stack spacing={1}>
      <Typography sx={{ fontWeight: 700 }} variant="subtitle2">
        {title}
      </Typography>
      {items.map((item) => (
        <ItemRow
          item={item}
          key={item.id}
          listId={listId}
          sections={sections}
        />
      ))}
    </Stack>
  );
}

function ItemRow({
  item,
  listId,
  sections,
}: {
  item: CollectionItem;
  listId: string;
  sections: CollectionSection[];
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <Box
      action={updateCollectionItem.bind(null, item.id, listId)}
      component="form"
      sx={rowFormSx}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ alignItems: { md: "center" } }}
      >
        <PosterThumb item={item.media} />
        <Typography sx={{ fontWeight: 600, minWidth: 120 }} noWrap>
          {item.media.title}
        </Typography>
        <TextField
          defaultValue={item.rank ?? ""}
          label="Rank"
          name="rank"
          size="small"
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          sx={{ width: 84 }}
          type="number"
        />
        <SectionSelect
          defaultValue={item.sectionId ?? ""}
          name="sectionId"
          sections={sections}
        />
        <TextField
          defaultValue={item.note ?? ""}
          label="Note"
          name="note"
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
        />
        <Button size="small" type="submit" variant="outlined">
          Save
        </Button>
        <IconButton
          aria-label="Remove item"
          disabled={isPending}
          onClick={() =>
            startTransition(() => removeCollectionItem(listId, item.id))
          }
          size="small"
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}

function SectionSelect({
  name,
  sections,
  defaultValue = "",
}: {
  name: string;
  sections: CollectionSection[];
  defaultValue?: string;
}) {
  return (
    <TextField
      defaultValue={defaultValue}
      label="Section"
      name={name}
      select
      size="small"
      sx={{ minWidth: 150 }}
    >
      <MenuItem value="">
        <em>Ungrouped</em>
      </MenuItem>
      {sections.map((section) => (
        <MenuItem key={section.id} value={section.id}>
          {section.title}
        </MenuItem>
      ))}
    </TextField>
  );
}

const rowFormSx: SxProps<Theme> = {
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 2,
  px: 1.5,
  py: 1,
};

const addFormSx: SxProps<Theme> = {
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 2,
  p: 1.5,
};

const addFormCaptionSx: SxProps<Theme> = {
  color: "text.secondary",
  display: "block",
  mb: 1,
};
