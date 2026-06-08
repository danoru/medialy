import type { RelationKind, ReleaseKind } from "@prisma/client";

/**
 * Display labels for `MediaRelation` / `MediaReleaseEvent`. Kept React/Next-free
 * so both server and client components can import it.
 *
 * A relation is stored once as a directed edge `from -(kind)-> to`. The same
 * edge reads two ways depending on which item's page you're on:
 *   - On the `from` item: the FORWARD label (the edge as authored).
 *   - On the `to` item: the INVERSE label (the edge seen from the target).
 * e.g. "A REMAKE_OF B" shows "Remake of → B" on A and "Remade as → A" on B.
 * Sequel/prequel is the single `FOLLOWS` edge: "A FOLLOWS B" => A is a sequel of
 * B, so B shows "Followed by → A". We deliberately avoid a separate "prequel"
 * kind — it's just the inverse view of the same edge.
 */
export const RELATION_FORWARD_LABEL: Record<RelationKind, string> = {
  FOLLOWS: "Sequel of",
  SPINOFF_OF: "Spin-off of",
  REMAKE_OF: "Remake of",
  ADAPTED_FROM: "Adapted from",
};

export const RELATION_INVERSE_LABEL: Record<RelationKind, string> = {
  FOLLOWS: "Followed by",
  SPINOFF_OF: "Has spin-off",
  REMAKE_OF: "Remade as",
  ADAPTED_FROM: "Adapted as",
};

/** Options for the "add relation" dropdown, phrased from the editing item's POV
 *  ("this item is a ___ of the one you pick"). */
export const RELATION_KIND_OPTIONS: { value: RelationKind; label: string }[] = [
  { value: "FOLLOWS", label: RELATION_FORWARD_LABEL.FOLLOWS },
  { value: "SPINOFF_OF", label: RELATION_FORWARD_LABEL.SPINOFF_OF },
  { value: "REMAKE_OF", label: RELATION_FORWARD_LABEL.REMAKE_OF },
  { value: "ADAPTED_FROM", label: RELATION_FORWARD_LABEL.ADAPTED_FROM },
];

export const RELEASE_KIND_LABEL: Record<ReleaseKind, string> = {
  REMASTER: "Remaster",
  PORT: "Port",
  RERELEASE: "Re-release",
  DLC: "DLC",
};

export const RELEASE_KIND_OPTIONS: { value: ReleaseKind; label: string }[] = [
  { value: "REMASTER", label: RELEASE_KIND_LABEL.REMASTER },
  { value: "PORT", label: RELEASE_KIND_LABEL.PORT },
  { value: "RERELEASE", label: RELEASE_KIND_LABEL.RERELEASE },
  { value: "DLC", label: RELEASE_KIND_LABEL.DLC },
];
