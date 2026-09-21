"use client";

import { useState, type MouseEvent } from "react";
import { Chip, Menu, MenuItem } from "@mui/material";
import Link from "next/link";

/**
 * Overflow menu for subgenre pills past the first 8 shown inline. A small
 * client component because opening a Menu needs local state; the rest of the
 * Discover page stays a server component.
 */
export function SubgenreMenu({
  options,
}: {
  options: { name: string; href: string }[];
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <Chip
        clickable
        label="More"
        onClick={handleOpen}
        sx={{
          bgcolor: "surface.1",
          border: "1px solid var(--mui-palette-border-subtle)",
          color: "text.primary",
          fontWeight: 500,
        }}
      />
      <Menu anchorEl={anchorEl} onClose={handleClose} open={open}>
        {options.map((option) => (
          <MenuItem
            component={Link}
            href={option.href}
            key={option.name}
            onClick={handleClose}
          >
            {option.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
