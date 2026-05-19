"use client";

import { Box, Button } from "@mui/material";
import { useEffect, useRef, useState } from "react";

export function SaveRatingsButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!form) return;

    const updateDirtyState = () => {
      setHasChanges(hasRatingChanges(form));
    };

    updateDirtyState();
    form.addEventListener("change", updateDirtyState);
    form.addEventListener("input", updateDirtyState);

    return () => {
      form.removeEventListener("change", updateDirtyState);
      form.removeEventListener("input", updateDirtyState);
    };
  }, []);

  return (
    <Box ref={containerRef} sx={{ display: hasChanges ? "block" : "none" }}>
      <Button type="submit" variant="contained">
        Save ratings
      </Button>
    </Box>
  );
}

function hasRatingChanges(form: HTMLFormElement) {
  const formData = new FormData(form);
  const ratingInputs = form.querySelectorAll<HTMLInputElement>(
    'input[name^="rating:"]',
  );

  return [...ratingInputs].some((input) => {
    const id = input.name.slice("rating:".length);
    const current = formData.get(`current:${id}`);

    return normalizeRatingValue(input.value) !== normalizeRatingValue(current);
  });
}

function normalizeRatingValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? String(parsed) : raw;
}
