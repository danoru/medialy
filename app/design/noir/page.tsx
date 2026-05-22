import Link from "next/link";

export const metadata = { title: "Vaporwave Noir · Design" };

// ─── Palette ────────────────────────────────────────────────────────────────
const BG = "#0A0810";
const SURFACE = "#13101A";
const TEXT = "#F4EEFA";
const MUTED = "#8A8395";
const RULE = "rgba(255,255,255,0.05)";

// One color per MediaType. Keys mirror the Prisma `MediaType` enum so this
// map can later be lifted into `lib/media-ui-helpers.tsx` to replace the
// existing `MEDIA_ACCENT` constant.
const MEDIA_TYPE_COLORS = {
  MOVIE: { label: "Film", hex: "#FF6FB5" },
  TV_SHOW: { label: "TV", hex: "#B58CFF" },
  VIDEO_GAME: { label: "Game", hex: "#38E1D6" },
  BOARD_GAME: { label: "Board", hex: "#7DFFC4" },
  BOOK: { label: "Book", hex: "#FFD56B" },
  MUSIC: { label: "Music", hex: "#FF9E7D" },
  MUSICAL: { label: "Musical", hex: "#4D7CFF" },
} as const;
type MType = keyof typeof MEDIA_TYPE_COLORS;
const accent = (t: MType) => MEDIA_TYPE_COLORS[t].hex;
const label = (t: MType) => MEDIA_TYPE_COLORS[t].label;

const PRIMARY = MEDIA_TYPE_COLORS.MOVIE.hex; // brand pink

// ─── Representative content (mirrors real getDashboardData fields) ──────────

// Tonight's pick (first item of `tonightPicksByMediaType` / `recommendations`)
const tonightPick = {
  title: "Dune: Part Two",
  type: "MOVIE" as MType,
  matchPercent: 96,
  reason: "Sci-Fi Drama · matches your top genre",
};

// `topItemsByMediaType` (Overall Top 10) — abbreviated to top 5 here
const overallTopTen: { title: string; type: MType; score: number }[] = [
  { title: "Severance", type: "TV_SHOW", score: 94 },
  { title: "Disco Elysium", type: "VIDEO_GAME", score: 93 },
  { title: "Past Lives", type: "MOVIE", score: 92 },
  { title: "Pedro Páramo", type: "BOOK", score: 90 },
  { title: "Hadestown", type: "MUSICAL", score: 89 },
];

// `tonightPicksByMediaType` flattened — recommendations carousel
const recommendations: { title: string; type: MType; matchPercent: number }[] = [
  { title: "Dune: Part Two", type: "MOVIE", matchPercent: 96 },
  { title: "Disco Elysium", type: "VIDEO_GAME", matchPercent: 94 },
  { title: "The Bear", type: "TV_SHOW", matchPercent: 92 },
  { title: "Pedro Páramo", type: "BOOK", matchPercent: 90 },
  { title: "Tunic", type: "VIDEO_GAME", matchPercent: 89 },
  { title: "Hadestown", type: "MUSICAL", matchPercent: 87 },
];

// `watchlistItems` (Watchlist signals)
const watchlistSignals: { title: string; type: MType; matchPercent: number }[] = [
  { title: "Anathem", type: "BOOK", matchPercent: 91 },
  { title: "Outer Wilds", type: "VIDEO_GAME", matchPercent: 89 },
  { title: "Pachinko", type: "TV_SHOW", matchPercent: 87 },
];

// `upcomingItems`
const upcoming: { title: string; date: string; type: MType }[] = [
  { title: "Mickey 17", date: "Mar 7", type: "MOVIE" },
  { title: "Death Stranding 2", date: "Mar 26", type: "VIDEO_GAME" },
  { title: "Andor S2", date: "Apr 22", type: "TV_SHOW" },
];

// `mediaTypeCounts` (Media breakdown)
const mediaBreakdown: { type: MType; count: number }[] = [
  { type: "MOVIE", count: 312 },
  { type: "TV_SHOW", count: 187 },
  { type: "VIDEO_GAME", count: 142 },
  { type: "BOOK", count: 98 },
  { type: "BOARD_GAME", count: 48 },
  { type: "MUSIC", count: 36 },
  { type: "MUSICAL", count: 24 },
];
const totalCount = mediaBreakdown.reduce((s, m) => s + m.count, 0);

// Headline counts (real fields on `getDashboardData`)
const stats = {
  totalItems: totalCount, // data.totalItems
  watchlistCount: 56, // data.watchlistCount
  comparisonCount: 1402, // data.comparisonCount
  missingMetadataCount: 12, // data.missingMetadataCount
};

// Single-color black→accent gradient for "posters"
const posterGradient = (hex: string) =>
  `linear-gradient(165deg, #0a0810 0%, #1a1624 35%, ${hex}40 75%, ${hex} 100%)`;

// ─── Page ───────────────────────────────────────────────────────────────────
export default function VaporwaveNoirDashboard() {
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
          "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(255,111,181,0.10), transparent 70%)",
      }}
    >
      <div style={{ padding: "32px 40px 80px", maxWidth: 1440, margin: "0 auto" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 28,
            gap: 24,
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
              Dashboard
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
              Welcome back,{" "}
              <span style={{ color: PRIMARY, textShadow: `0 0 24px ${PRIMARY}70` }}>
                Anna
              </span>
              .
            </h1>
            <p style={{ color: MUTED, fontSize: 14, margin: "6px 0 0" }}>
              Recommendations, watchlist, and library signals at a glance.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SearchPill />
            <Avatar />
          </div>
        </header>

        {/* Compact stat row — real fields */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <CompactStat label="Total items" value={stats.totalItems.toLocaleString()} type="MOVIE" />
          <CompactStat label="Watchlist" value={stats.watchlistCount.toLocaleString()} type="TV_SHOW" />
          <CompactStat
            label="Comparisons"
            value={stats.comparisonCount.toLocaleString()}
            type="VIDEO_GAME"
          />
          <CompactStat
            label="Metadata gaps"
            value={stats.missingMetadataCount.toLocaleString()}
            type="BOOK"
          />
        </div>

        {/* HERO: Tonight's Pick + Recommendations rail */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 20,
            marginBottom: 36,
          }}
        >
          <TonightPickHero />
          <div>
            <SectionHeader title="More for tonight" sub="From your recommendations queue" />
            <div
              style={{
                background: SURFACE,
                border: `1px solid ${RULE}`,
                borderRadius: 18,
                padding: 4,
              }}
            >
              {recommendations.slice(1, 5).map((r, i, arr) => (
                <div
                  key={r.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 18px",
                    borderLeft: `2px solid ${accent(r.type)}`,
                    borderTopLeftRadius: i === 0 ? 16 : 0,
                    borderBottomLeftRadius: i === arr.length - 1 ? 16 : 0,
                    borderBottom: i < arr.length - 1 ? `1px solid ${RULE}` : "none",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: 15 }}>{r.title}</p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: accent(r.type),
                      }}
                    >
                      {label(r.type)}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontVariantNumeric: "tabular-nums",
                      color: TEXT,
                      fontFamily: "var(--font-heading), serif",
                      fontWeight: 600,
                    }}
                  >
                    {r.matchPercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Media-type legend */}
        <Legend />

        {/* Overall Top 10 + Media breakdown */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 24,
            marginBottom: 40,
          }}
        >
          <div>
            <SectionHeader title="Overall top 10" sub="Across every media type you track" />
            <div
              style={{
                background: SURFACE,
                border: `1px solid ${RULE}`,
                borderRadius: 18,
                padding: 6,
              }}
            >
              {overallTopTen.map((t, i, arr) => (
                <div
                  key={t.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "16px 18px",
                    borderLeft: `2px solid ${accent(t.type)}`,
                    borderTopLeftRadius: i === 0 ? 14 : 0,
                    borderBottomLeftRadius: i === arr.length - 1 ? 14 : 0,
                    borderBottom: i < arr.length - 1 ? `1px solid ${RULE}` : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-heading), serif",
                      fontWeight: 600,
                      fontSize: 20,
                      color: MUTED,
                      width: 32,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: 15 }}>{t.title}</p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: accent(t.type),
                      }}
                    >
                      {label(t.type)}
                    </p>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-heading), serif",
                      fontSize: 18,
                      color: accent(t.type),
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                    }}
                  >
                    {t.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader title="Media breakdown" sub={`${stats.totalItems} tracked items`} />
            <div
              style={{
                background: SURFACE,
                border: `1px solid ${RULE}`,
                borderRadius: 18,
                padding: 22,
              }}
            >
              {mediaBreakdown.map((row) => {
                const pct = (row.count / Math.max(...mediaBreakdown.map((m) => m.count))) * 100;
                return (
                  <div key={row.type} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                          color: accent(row.type),
                        }}
                      >
                        {label(row.type)}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: MUTED,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {row.count}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 99,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: accent(row.type),
                          boxShadow: `0 0 10px ${accent(row.type)}60`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Watchlist signals + Upcoming */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
          <div>
            <SectionHeader title="Watchlist signals" sub="What's worth your time on the list" />
            <div
              style={{
                background: SURFACE,
                border: `1px solid ${RULE}`,
                borderRadius: 18,
                padding: 6,
              }}
            >
              {watchlistSignals.map((w, i, arr) => (
                <div
                  key={w.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "16px 18px",
                    borderLeft: `2px solid ${accent(w.type)}`,
                    borderTopLeftRadius: i === 0 ? 14 : 0,
                    borderBottomLeftRadius: i === arr.length - 1 ? 14 : 0,
                    borderBottom: i < arr.length - 1 ? `1px solid ${RULE}` : "none",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: 15 }}>{w.title}</p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: accent(w.type),
                      }}
                    >
                      {label(w.type)}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: MUTED,
                      marginRight: 16,
                    }}
                  >
                    Match
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      color: accent(w.type),
                      fontFamily: "var(--font-heading), serif",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      minWidth: 44,
                      textAlign: "right",
                    }}
                  >
                    {w.matchPercent}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader title="Upcoming releases" sub="From your watchlist" />
            <div
              style={{
                background: SURFACE,
                border: `1px solid ${RULE}`,
                borderRadius: 18,
                padding: 4,
              }}
            >
              {upcoming.map((u, i, arr) => {
                const a = accent(u.type);
                return (
                  <div
                    key={u.title}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "16px 20px",
                      borderLeft: `2px solid ${a}`,
                      borderTopLeftRadius: i === 0 ? 16 : 0,
                      borderBottomLeftRadius: i === arr.length - 1 ? 16 : 0,
                      borderBottom: i < arr.length - 1 ? `1px solid ${RULE}` : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        textAlign: "center",
                        marginRight: 18,
                        paddingRight: 18,
                        borderRight: `1px solid ${RULE}`,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-heading), serif",
                          fontSize: 22,
                          fontWeight: 600,
                          color: a,
                          textShadow: `0 0 14px ${a}50`,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {u.date.split(" ")[1]}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 10,
                          letterSpacing: "0.2em",
                          color: MUTED,
                          textTransform: "uppercase",
                        }}
                      >
                        {u.date.split(" ")[0]}
                      </p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: 15 }}>{u.title}</p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          color: a,
                          fontSize: 11,
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                        }}
                      >
                        {label(u.type)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer link to media detail mockup */}
        <div style={{ marginTop: 56, paddingTop: 24, borderTop: `1px solid ${RULE}` }}>
          <Link
            href="/design/noir/media"
            style={{
              color: PRIMARY,
              textDecoration: "none",
              fontSize: 13,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Next mockup · Media detail →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function TonightPickHero() {
  const a = accent(tonightPick.type);
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        minHeight: 380,
        background: posterGradient(a),
        display: "flex",
        alignItems: "flex-end",
        padding: 32,
        borderLeft: `2px solid ${a}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, transparent 35%, rgba(10,8,16,0.92) 100%)",
        }}
      />
      {/* Match badge */}
      <div
        style={{
          position: "absolute",
          top: 22,
          right: 22,
          zIndex: 1,
          background: "rgba(10,8,16,0.5)",
          backdropFilter: "blur(10px)",
          border: `1px solid ${a}60`,
          borderRadius: 99,
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          Match
        </span>
        <span
          style={{
            fontFamily: "var(--font-heading), serif",
            fontSize: 18,
            fontWeight: 600,
            color: a,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {tonightPick.matchPercent}%
        </span>
      </div>
      <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
        <span
          style={{
            display: "inline-block",
            fontSize: 10,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: a,
            border: `1px solid ${a}70`,
            padding: "5px 10px",
            borderRadius: 999,
            marginBottom: 14,
          }}
        >
          Tonight&apos;s pick · {label(tonightPick.type)}
        </span>
        <h2
          style={{
            fontFamily: "var(--font-heading), serif",
            fontSize: 56,
            margin: "0 0 8px",
            letterSpacing: "-0.025em",
            fontWeight: 600,
          }}
        >
          {tonightPick.title}
        </h2>
        <p style={{ color: "#cfcad6", margin: "0 0 20px", fontSize: 15 }}>
          {tonightPick.reason}
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            style={{
              background: TEXT,
              color: BG,
              border: 0,
              borderRadius: 999,
              padding: "12px 22px",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            See details
          </button>
          <button
            style={{
              background: "transparent",
              color: TEXT,
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 999,
              padding: "12px 22px",
              fontWeight: 500,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Not tonight
          </button>
        </div>
      </div>
    </div>
  );
}

function CompactStat({ label, value, type }: { label: string; value: string; type: MType }) {
  const a = accent(type);
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${RULE}`,
        borderLeft: `2px solid ${a}`,
        borderRadius: 14,
        padding: "16px 18px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: -40,
          right: -40,
          width: 120,
          height: 120,
          background: `radial-gradient(circle, ${a}20, transparent 70%)`,
          filter: "blur(18px)",
        }}
      />
      <p
        style={{
          fontSize: 10,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: MUTED,
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "var(--font-heading), serif",
          fontSize: 32,
          margin: "8px 0 0",
          fontWeight: 650,
          letterSpacing: "-0.03em",
          color: a,
          textShadow: `0 0 20px ${a}40`,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      style={{
        marginBottom: 16,
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-heading), serif",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
        <p style={{ margin: "4px 0 0", color: MUTED, fontSize: 13 }}>{sub}</p>
      </div>
      <Link
        href="#"
        style={{
          color: PRIMARY,
          fontSize: 13,
          textDecoration: "none",
          letterSpacing: "0.05em",
        }}
      >
        See all →
      </Link>
    </div>
  );
}

function Legend() {
  return (
    <div
      style={{
        display: "flex",
        gap: 22,
        marginBottom: 28,
        paddingBottom: 18,
        borderBottom: `1px solid ${RULE}`,
        flexWrap: "wrap",
      }}
    >
      {(Object.keys(MEDIA_TYPE_COLORS) as MType[]).map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: accent(k),
              boxShadow: `0 0 8px ${accent(k)}80`,
            }}
          />
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {label(k)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SearchPill() {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${RULE}`,
        borderRadius: 999,
        padding: "10px 16px",
        color: MUTED,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 260,
      }}
    >
      <span>⌕</span>
      <span>Search media, people, tags…</span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: 11,
          color: "#5a5566",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "2px 6px",
          borderRadius: 4,
        }}
      >
        ⌘K
      </span>
    </div>
  );
}

function Avatar() {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 99,
        background: `linear-gradient(135deg, ${BG}, ${PRIMARY})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: TEXT,
        fontWeight: 700,
        fontSize: 15,
        boxShadow: `0 0 16px ${PRIMARY}40`,
        border: `1px solid ${PRIMARY}60`,
      }}
    >
      A
    </div>
  );
}
