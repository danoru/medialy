"use client";

import FirstPageIcon from "@mui/icons-material/FirstPage";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import LastPageIcon from "@mui/icons-material/LastPage";
import { IconButton, MenuItem, Stack, TextField, Tooltip } from "@mui/material";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type PageOption = {
  href: string;
  page: number;
};

type MediaPageNavigatorProps = {
  page: number;
  pages: PageOption[];
};

export function MediaPageNavigator({ page, pages }: MediaPageNavigatorProps) {
  const router = useRouter();
  const first = pages[0];
  const last = pages.at(-1);
  const previous = pages.find((option) => option.page === page - 1);
  const next = pages.find((option) => option.page === page + 1);

  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: "center", flexWrap: "nowrap" }}
    >
      <PageIconButton
        disabled={!first || page <= first.page}
        href={first?.href}
        label="First page"
      >
        <FirstPageIcon fontSize="small" />
      </PageIconButton>
      <PageIconButton
        disabled={!previous}
        href={previous?.href}
        label="Previous page"
      >
        <KeyboardArrowLeftIcon fontSize="small" />
      </PageIconButton>
      <TextField
        label="Page"
        onChange={(event) => {
          const nextPage = Number(event.target.value);
          const option = pages.find((entry) => entry.page === nextPage);
          if (option) router.push(option.href);
        }}
        select
        size="small"
        sx={{ minWidth: 128 }}
        value={page}
      >
        {pages.map((option) => (
          <MenuItem key={option.page} value={option.page}>
            Page {option.page}
          </MenuItem>
        ))}
      </TextField>
      <PageIconButton disabled={!next} href={next?.href} label="Next page">
        <KeyboardArrowRightIcon fontSize="small" />
      </PageIconButton>
      <PageIconButton
        disabled={!last || page >= last.page}
        href={last?.href}
        label="Last page"
      >
        <LastPageIcon fontSize="small" />
      </PageIconButton>
    </Stack>
  );
}

function PageIconButton({
  children,
  disabled,
  href,
  label,
}: {
  children: ReactNode;
  disabled: boolean;
  href?: string;
  label: string;
}) {
  const router = useRouter();

  return (
    <Tooltip title={label}>
      <span style={{ display: "inline-flex" }}>
        <IconButton
          aria-label={label}
          disabled={disabled}
          onClick={() => {
            if (href) router.push(href);
          }}
          size="small"
          sx={{ height: 36, width: 36 }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}
