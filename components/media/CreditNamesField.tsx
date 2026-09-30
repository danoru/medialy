"use client";

import { useEffect, useRef, useState } from "react";
import { Autocomplete, Box, Chip, TextField, Typography } from "@mui/material";
import type { CreditRole } from "@prisma/client";
import { searchCreditNames } from "@/app/media/actions";
import type { ContributorSuggestion } from "@/lib/db/people";
import { normalizeSearchText } from "@/lib/text-normalization";

/** Typing pause before asking for suggestions. */
const SUGGEST_DELAY_MS = 200;

/**
 * One credit role on the media form ("Directed by", "Starring"…) as name chips
 * with suggestions from people already in the catalog, so the same person is
 * picked rather than retyped with a slightly different spelling.
 *
 * A name nobody in the catalog has yet stays allowed — it creates that person —
 * but its chip is dashed and marked new, so a typo reads as one before saving.
 * The form still submits the semicolon-separated text the server has always
 * parsed, through a hidden input.
 */
export function CreditNamesField({
  defaultNames,
  label,
  name,
  role,
}: {
  defaultNames: string[];
  label: string;
  /** The form field the server reads (see `creditFieldName`). */
  name: string;
  role: CreditRole;
}) {
  const [names, setNames] = useState<string[]>(defaultNames);
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<ContributorSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  // Names known to exist: the item's current credits and anything suggested.
  const [known, setKnown] = useState(
    () => new Set(defaultNames.map((entry) => normalizeSearchText(entry))),
  );
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ask for suggestions once typing pauses; only the newest answer is kept.
  const suggest = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    const query = text.trim();
    const request = ++latest.current;
    if (query.length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchCreditNames(role, query);
        if (request !== latest.current) return;
        setOptions(found);
        setKnown((current) => {
          const next = new Set(current);
          for (const option of found)
            next.add(normalizeSearchText(option.name));
          return next;
        });
      } finally {
        if (request === latest.current) setLoading(false);
      }
    }, SUGGEST_DELAY_MS);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const add = (raw: string[]) => {
    setNames((current) => {
      const seen = new Set(current.map((entry) => normalizeSearchText(entry)));
      const next = [...current];
      for (const entry of raw.map((value) => value.trim()).filter(Boolean)) {
        const key = normalizeSearchText(entry);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(entry);
        }
      }
      return next;
    });
  };

  return (
    <>
      <input name={name} type="hidden" value={names.join("; ")} />
      <Box
        onBlur={(event) => {
          // A name typed but not yet entered still counts once focus leaves
          // the field (the popup's own focus moves stay inside it).
          if (event.currentTarget.contains(event.relatedTarget as Node | null))
            return;
          if (input.trim()) {
            add([input]);
            setInput("");
            suggest("");
          }
        }}
      >
        <Autocomplete<ContributorSuggestion | string, true, false, true>
          filterOptions={(list) => list}
          freeSolo
          getOptionLabel={(option) =>
            typeof option === "string" ? option : option.name
          }
          inputValue={input}
          isOptionEqualToValue={(option, value) =>
            normalizeSearchText(
              typeof option === "string" ? option : option.name,
            ) ===
            normalizeSearchText(typeof value === "string" ? value : value.name)
          }
          loading={loading}
          multiple
          onChange={(_, value) => {
            setNames([]);
            add(
              value.map((entry) =>
                typeof entry === "string" ? entry : entry.name,
              ),
            );
          }}
          onInputChange={(_, value, reason) => {
            // Semicolons and commas separate names, as they always have.
            if (reason === "input" && /[;,]/.test(value)) {
              const parts = value.split(/[;,]/);
              add(parts.slice(0, -1));
              const rest = parts.at(-1)?.trimStart() ?? "";
              setInput(rest);
              suggest(rest);
              return;
            }
            setInput(value);
            if (reason === "input") suggest(value);
          }}
          options={options.filter(
            (option) =>
              !names.some(
                (entry) =>
                  normalizeSearchText(entry) ===
                  normalizeSearchText(option.name),
              ),
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              helperText="Pick someone already on Medialy, or type a new name and press Enter."
              label={label}
            />
          )}
          renderOption={(props, option) => {
            const { key, ...rest } = props as typeof props & { key: string };
            if (typeof option === "string") {
              return (
                <li key={key} {...rest}>
                  {option}
                </li>
              );
            }
            return (
              <Box
                component="li"
                key={key}
                {...rest}
                sx={{ display: "block !important" }}
              >
                <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                  {option.name}
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: "0.8125rem" }}
                >
                  {option.roles} · {option.titleCount}{" "}
                  {option.titleCount === 1 ? "title" : "titles"}
                </Typography>
              </Box>
            );
          }}
          renderValue={(value, getItemProps) =>
            value.map((entry, index) => {
              const label = typeof entry === "string" ? entry : entry.name;
              const isNew = !known.has(normalizeSearchText(label));
              const { key, ...itemProps } = getItemProps({ index });
              return (
                <Chip
                  key={key}
                  {...itemProps}
                  label={isNew ? `${label} · new` : label}
                  sx={isNew ? { borderStyle: "dashed" } : undefined}
                  title={
                    isNew
                      ? "Not on Medialy yet: saving adds this person"
                      : undefined
                  }
                  variant={isNew ? "outlined" : "filled"}
                />
              );
            })
          }
          value={names}
        />
      </Box>
    </>
  );
}
