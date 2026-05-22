import Link from "next/link";

export const metadata = { title: "Vaporwave Noir · Library" };

// ─── Palette (shared with /design/noir) ─────────────────────────────────────
const BG = "#0A0810";
const SURFACE = "#13101A";
const SURFACE_2 = "#1A1624";
const TEXT = "#F4EEFA";
const MUTED = "#8A8395";
const RULE = "rgba(255,255,255,0.05)";
const RULE_STRONG = "rgba(255,255,255,0.08)";

// Single source of truth — mirrors `lib/media-ui-helpers.tsx` MEDIA_ACCENT.
const MEDIA_TYPE_COLORS = {
  MOVIE: { label: "Film", hex: "#FF6FB5" },
  TV_SHOW: { label: "TV", hex: "#B58CFF" },
  VIDEO_GAME: { label: "Game", hex: "#38E1D6" },
  BOARD_GAME: { label: "Board", hex: "#7DFFC4" },
  BOOK: { label: "Book", hex: "#FFD56B" },
  MUSIC: { label: "Music", hex: "#FF6B6B" },
  MUSICAL: { label: "Musical", hex: "#4D7CFF" },
} as const;
type MType = keyof typeof MEDIA_TYPE_COLORS;
const accent = (t: MType) => MEDIA_TYPE_COLORS[t].hex;
const label = (t: MType) => MEDIA_TYPE_COLORS[t].label;
const BRAND = "#FF9E7D"; // peach — used for "All" tab + chrome

// ─── Representative content — mirrors fields in the real `/media` page ──────
// `MediaListItem` shape: title, mediaType, status, genres[], tags[],
// computedPersonalScore, computedConsensusScore, personalRating, pairwiseScore,
// isFavorite, isArchived, updatedAt.

type Status =
  | "COMPLETED"
  | "IN_PROGRESS"
  | "WATCHLIST"
  | "BACKLOG"
  | "DROPPED"
  | "PAUSED"
  | "UNTRACKED";

const STATUS_LABEL: Record<Status, string> = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In progress",
  WATCHLIST: "Watchlist",
  BACKLOG: "Backlog",
  DROPPED: "Dropped",
  PAUSED: "Paused",
  UNTRACKED: "Untracked",
};

const items: Array<{
  title: string;
  type: MType;
  status: Status;
  genres: string[];
  tags: string[];
  personal: number | null;
  consensus: number | null;
  explicit: number | null;
  favorite?: boolean;
  archived?: boolean;
  updated: string;
}> = [
  {
    title: "Severance",
    type: "TV_SHOW",
    status: "IN_PROGRESS",
    genres: ["Drama", "Sci-Fi"],
    tags: ["Workplace", "Mystery Box"],
    personal: 9.4,
    consensus: 9.1,
    explicit: 9.5,
    favorite: true,
    updated: "May 18, 2026",
  },
  {
    title: "Disco Elysium",
    type: "VIDEO_GAME",
    status: "COMPLETED",
    genres: ["RPG"],
    tags: ["Detective", "Dialogue-Driven"],
    personal: 9.3,
    consensus: 9.2,
    explicit: 9.5,
    favorite: true,
    updated: "May 12, 2026",
  },
  {
    title: "Past Lives",
    type: "MOVIE",
    status: "COMPLETED",
    genres: ["Drama", "Romance"],
    tags: ["Slow Burn", "Diaspora"],
    personal: 9.2,
    consensus: 8.6,
    explicit: 9.0,
    updated: "May 04, 2026",
  },
  {
    title: "Pedro Páramo",
    type: "BOOK",
    status: "COMPLETED",
    genres: ["Magical Realism"],
    tags: ["Mexico", "Hauntology"],
    personal: 9.0,
    consensus: 8.8,
    explicit: 9.0,
    updated: "Apr 27, 2026",
  },
  {
    title: "Hadestown",
    type: "MUSICAL",
    status: "COMPLETED",
    genres: ["Folk Opera"],
    tags: ["Mythology", "Concept Album"],
    personal: 8.9,
    consensus: 8.7,
    explicit: 9.0,
    favorite: true,
    updated: "Apr 21, 2026",
  },
  {
    title: "Wingspan",
    type: "BOARD_GAME",
    status: "COMPLETED",
    genres: ["Engine Builder"],
    tags: ["Solo Mode", "Nature"],
    personal: 8.6,
    consensus: 8.4,
    explicit: 8.5,
    updated: "Apr 14, 2026",
  },
  {
    title: "Tunic",
    type: "VIDEO_GAME",
    status: "BACKLOG",
    genres: ["Adventure"],
    tags: ["Cryptography", "Zelda-like"],
    personal: 8.7,
    consensus: 8.3,
    explicit: null,
    updated: "Apr 09, 2026",
  },
  {
    title: "Anathem",
    type: "BOOK",
    status: "WATCHLIST",
    genres: ["Science Fiction"],
    tags: ["Philosophy", "Long"],
    personal: null,
    consensus: 8.1,
    explicit: null,
    updated: "Apr 02, 2026",
  },
  {
    title: "Mickey 17",
    type: "MOVIE",
    status: "WATCHLIST",
    genres: ["Sci-Fi", "Comedy"],
    tags: ["Bong Joon-ho"],
    personal: null,
    consensus: 7.8,
    explicit: null,
    updated: "Mar 30, 2026",
  },
  {
    title: "Pachinko",
    type: "TV_SHOW",
    status: "PAUSED",
    genres: ["Drama"],
    tags: ["Multi-Generational"],
    personal: 8.2,
    consensus: 8.4,
    explicit: 8.0,
    updated: "Mar 22, 2026",
  },
  {
    title: "The Bear",
    type: "TV_SHOW",
    status: "COMPLETED",
    genres: ["Drama"],
    tags: ["Kitchen", "Found Family"],
    personal: 8.8,
    consensus: 8.7,
    explicit: 9.0,
    updated: "Mar 14, 2026",
  },
  {
    title: "Outer Wilds",
    type: "VIDEO_GAME",
    status: "WATCHLIST",
    genres: ["Adventure"],
    tags: ["Time Loop", "Exploration"],
    personal: null,
    consensus: 9.0,
    explicit: null,
    updated: "Mar 08, 2026",
  },
];

const tabs: Array<{ key: "ALL" | MType; label: string; count: number }> = [
  { key: "ALL", label: "All", count: 847 },
  { key: "MOVIE", label: "Movies", count: 312 },
  { key: "TV_SHOW", label: "TV", count: 187 },
  { key: "VIDEO_GAME", label: "Games", count: 142 },
  { key: "BOOK", label: "Books", count: 98 },
  { key: "BOARD_GAME", label: "Board", count: 48 },
  { key: "MUSIC", label: "Music", count: 36 },
  { key: "MUSICAL", label: "Musicals", count: 24 },
];

const selectedTab: "ALL" | MType = "ALL";
const selectedAccent = selectedTab === "ALL" ? BRAND : accent(selectedTab);

const posterGradient = (hex: string) =>
  `linear-gradient(160deg, #0a0810 0%, #1a1624 40%, ${hex}38 78%, ${hex} 100%)`;

// ─── Page ───────────────────────────────────────────────────────────────────
export default function VaporwaveNoirLibrary() {
  return (
    <div
      style={{
        marginInline: "-24px",
        marginTop: "-24px",
        background: BG,
        color: TEXT,
        minHeight: "calc(100vh - 64px)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 80% 0%, rgba(255,158,125,0.10), transparent 70%)",
      }}
    >
      <div
        style={{
          padding: "32px 40px 80px",
          maxWidth: 1440,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            marginBottom: 24,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: MUTED,
                margin: 0,
              }}
            >
              Library
            </p>
            <h1
              style={{
                fontFamily: "var(--font-heading), serif",
                fontSize: 40,
                margin: "6px 0 0",
                letterSpacing: "-0.025em",
                fontWeight: 650,
              }}
            >
              Everything,{" "}
              <span
                style={{
                  color: selectedAccent,
                  textShadow: `0 0 24px ${selectedAccent}70`,
                }}
              >
                rated
              </span>
              .
            </h1>
            <p style={{ color: MUTED, fontSize: 14, margin: "6px 0 0" }}>
              Filter, rate inline, and re-sort by personal or consensus signal.
            </p>
          </div>
          <Link
            href="/media/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 999,
              background: `linear-gradient(135deg, ${BRAND}, #FFB59A)`,
              color: "#0A0810",
              fontWeight: 600,
              fontSize: 13,
              textDecoration: "none",
              boxShadow: `0 2px 8px ${BRAND}73, 0 0 20px ${BRAND}59`,
              border: `1px solid ${BRAND}`,
            }}
          >
            + Add Media
          </Link>
        </header>

        {/* Tab strip — All + 7 media types, color-coded; selected has glow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 6,
            borderRadius: 14,
            background: SURFACE,
            border: `1px solid ${RULE}`,
            marginBottom: 18,
            overflowX: "auto",
          }}
        >
          {tabs.map((t) => {
            const tabAccent = t.key === "ALL" ? BRAND : accent(t.key);
            const isSelected = t.key === selectedTab;
            return (
              <button
                key={t.key}
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid transparent",
                  background: isSelected
                    ? `linear-gradient(180deg, ${tabAccent}1F, ${tabAccent}0A)`
                    : "transparent",
                  borderColor: isSelected ? `${tabAccent}55` : "transparent",
                  color: isSelected ? tabAccent : `${tabAccent}99`,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: isSelected
                    ? `inset 0 0 0 1px ${tabAccent}33, 0 0 16px ${tabAccent}33`
                    : "none",
                }}
              >
                {t.label}
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: `${tabAccent}1A`,
                    color: tabAccent,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                  }}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter shelf */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr repeat(5, 1fr) auto",
            gap: 10,
            padding: 14,
            borderRadius: 16,
            background: SURFACE,
            border: `1px solid ${RULE}`,
            borderLeft: `2px solid ${selectedAccent}`,
            marginBottom: 18,
            alignItems: "end",
          }}
        >
          <FilterField label="Title" placeholder="Search titles…" value="" />
          <FilterField label="Genre" placeholder="All genres" value="" select />
          <FilterField label="Tag" placeholder="All tags" value="" select />
          <FilterField
            label="Status"
            placeholder="All statuses"
            value=""
            select
          />
          <FilterField label="Sort" value="Updated" select />
          <FilterField label="Order" value="Descending" select />
          <button
            type="button"
            style={{
              height: 38,
              padding: "0 18px",
              borderRadius: 10,
              border: `1px solid ${selectedAccent}66`,
              background: `${selectedAccent}1A`,
              color: selectedAccent,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </div>

        {/* Toolbar above table — count + secondary actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
            Showing <span style={{ color: TEXT, fontWeight: 600 }}>1–50</span>{" "}
            of <span style={{ color: TEXT, fontWeight: 600 }}>847</span>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ChromePill>Favorites</ChromePill>
            <ChromePill>Include archived</ChromePill>
          </div>
        </div>

        {/* Results — accent left-border per row, inline rating cell, scores */}
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${RULE}`,
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          {/* Column header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(260px, 1.6fr) 90px 120px 1.2fr 76px 76px 96px 100px",
              alignItems: "center",
              padding: "12px 18px",
              gap: 12,
              background: SURFACE_2,
              borderBottom: `1px solid ${RULE_STRONG}`,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: MUTED,
              fontWeight: 600,
            }}
          >
            <span>Title</span>
            <span>Type</span>
            <span>Status</span>
            <span>Genres</span>
            <span style={{ textAlign: "right" }}>Personal</span>
            <span style={{ textAlign: "right" }}>Consensus</span>
            <span style={{ textAlign: "right" }}>Rate</span>
            <span style={{ textAlign: "right" }}>Updated</span>
          </div>

          {items.map((item) => (
            <Row key={item.title} item={item} />
          ))}

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 18px",
              borderTop: `1px solid ${RULE_STRONG}`,
              background: SURFACE_2,
            }}
          >
            <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
              Page <span style={{ color: TEXT, fontWeight: 600 }}>1</span> of{" "}
              <span style={{ color: TEXT, fontWeight: 600 }}>17</span>
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: `1px solid ${selectedAccent}66`,
                  background: `linear-gradient(135deg, ${selectedAccent}, ${selectedAccent}B3)`,
                  color: "#0A0810",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: `0 0 18px ${selectedAccent}55`,
                }}
              >
                Save ratings
              </button>
              <Pager />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Row({
  item,
}: {
  item: {
    title: string;
    type: MType;
    status: Status;
    genres: string[];
    tags: string[];
    personal: number | null;
    consensus: number | null;
    explicit: number | null;
    favorite?: boolean;
    archived?: boolean;
    updated: string;
  };
}) {
  const a = accent(item.type);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(260px, 1.6fr) 90px 120px 1.2fr 76px 76px 96px 100px",
        alignItems: "center",
        padding: "12px 18px",
        gap: 12,
        borderLeft: `2px solid ${a}`,
        borderBottom: `1px solid ${RULE}`,
        background: `linear-gradient(90deg, ${a}0A 0%, transparent 18%)`,
      }}
    >
      {/* Title cell — mini poster swatch + title + tags */}
      <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
        <div
          aria-hidden
          style={{
            width: 34,
            height: 48,
            flex: "0 0 auto",
            borderRadius: 6,
            background: posterGradient(a),
            border: `1px solid ${a}33`,
            boxShadow: `0 0 12px ${a}33`,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
              color: TEXT,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.title}
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 4,
              flexWrap: "wrap",
            }}
          >
            {item.favorite ? <MiniChip color={a}>★ Favorite</MiniChip> : null}
            {item.archived ? <MiniChip color={MUTED}>Archived</MiniChip> : null}
            {item.tags.slice(0, 2).map((tag) => (
              <MiniChip key={tag} color={MUTED}>
                {tag}
              </MiniChip>
            ))}
          </div>
        </div>
      </div>

      {/* Type */}
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: a,
          fontWeight: 700,
        }}
      >
        {label(item.type)}
      </span>

      {/* Status */}
      <StatusPill status={item.status} accent={a} />

      {/* Genres */}
      <span
        style={{
          fontSize: 13,
          color: MUTED,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.genres.join(", ") || "—"}
      </span>

      {/* Personal */}
      <ScoreCell value={item.personal} highlight={a} />
      {/* Consensus */}
      <ScoreCell value={item.consensus} />

      {/* Rate input */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <input
          aria-label={`Rate ${item.title}`}
          defaultValue={item.explicit ?? ""}
          placeholder="—"
          inputMode="decimal"
          style={{
            width: 70,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${RULE_STRONG}`,
            background: BG,
            color: TEXT,
            padding: "0 8px",
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
            outline: "none",
          }}
        />
      </div>

      {/* Updated */}
      <span
        style={{
          fontSize: 12,
          color: MUTED,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {item.updated}
      </span>
    </div>
  );
}

function ScoreCell({
  value,
  highlight,
}: {
  value: number | null;
  highlight?: string;
}) {
  if (value == null) {
    return (
      <span
        style={{
          textAlign: "right",
          fontSize: 13,
          color: MUTED,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        —
      </span>
    );
  }
  return (
    <span
      style={{
        textAlign: "right",
        fontFamily: "var(--font-heading), serif",
        fontSize: 16,
        fontWeight: 600,
        color: highlight ?? TEXT,
        fontVariantNumeric: "tabular-nums",
        textShadow: highlight ? `0 0 12px ${highlight}55` : "none",
      }}
    >
      {value.toFixed(1)}
    </span>
  );
}

function StatusPill({ status, accent }: { status: Status; accent: string }) {
  const isActive = status === "IN_PROGRESS" || status === "WATCHLIST";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        background: isActive ? `${accent}1A` : "rgba(255,255,255,0.04)",
        color: isActive ? accent : MUTED,
        border: `1px solid ${isActive ? `${accent}55` : RULE_STRONG}`,
        whiteSpace: "nowrap",
        width: "fit-content",
      }}
    >
      {isActive ? (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: accent,
            boxShadow: `0 0 8px ${accent}`,
          }}
        />
      ) : null}
      {STATUS_LABEL[status]}
    </span>
  );
}

function MiniChip({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      style={{
        fontSize: 10,
        letterSpacing: "0.04em",
        padding: "2px 7px",
        borderRadius: 999,
        border: `1px solid ${color}40`,
        color,
      }}
    >
      {children}
    </span>
  );
}

function FilterField({
  label,
  value,
  placeholder,
  select,
}: {
  label: string;
  value: string;
  placeholder?: string;
  select?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <div
        style={{
          height: 38,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          borderRadius: 10,
          border: `1px solid ${RULE_STRONG}`,
          background: BG,
          color: value ? TEXT : MUTED,
          fontSize: 13,
        }}
      >
        <span style={{ flex: 1 }}>{value || placeholder}</span>
        {select ? (
          <span style={{ color: MUTED, fontSize: 10 }}>▾</span>
        ) : null}
      </div>
    </div>
  );
}

function ChromePill({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${RULE_STRONG}`,
        background: SURFACE_2,
        color: MUTED,
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Pager() {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {["‹", "1", "2", "3", "…", "17", "›"].map((p, i) => {
        const isActive = p === "1";
        return (
          <button
            key={`${p}-${i}`}
            type="button"
            style={{
              minWidth: 32,
              height: 32,
              padding: "0 10px",
              borderRadius: 8,
              border: `1px solid ${isActive ? `${BRAND}66` : RULE_STRONG}`,
              background: isActive ? `${BRAND}1A` : "transparent",
              color: isActive ? BRAND : MUTED,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
