export const metadata = { title: "Vaporwave Noir · Discover" };

// ─── Palette (shared with /design/noir) ─────────────────────────────────────
const BG = "#0A0810";
const SURFACE = "#13101A";
const SURFACE_2 = "#1A1624";
const TEXT = "#F4EEFA";
const MUTED = "#8A8395";
const RULE = "rgba(255,255,255,0.05)";
const RULE_STRONG = "rgba(255,255,255,0.08)";

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

// ─── Representative data — mirrors what `/discover` actually renders ────────
// `MediaItem`-shaped: title, mediaType, tags[], plus scores. We're previewing
// the MOVIE → Drama "world" since that's the default route.

const SELECTED_TYPE: MType = "MOVIE";
const SELECTED_TYPE_ACCENT = accent(SELECTED_TYPE);

const tabs: Array<{ key: MType; label: string }> = [
  { key: "MOVIE", label: "Movies" },
  { key: "TV_SHOW", label: "TV" },
  { key: "VIDEO_GAME", label: "Games" },
  { key: "BOOK", label: "Books" },
  { key: "BOARD_GAME", label: "Board" },
  { key: "MUSIC", label: "Music" },
  { key: "MUSICAL", label: "Musicals" },
];

// Genre "worlds" — GenreRail chips
const genres: Array<{ name: string; count: number; selected?: boolean }> = [
  { name: "Drama", count: 84, selected: true },
  { name: "Sci-Fi", count: 52 },
  { name: "Thriller", count: 47 },
  { name: "Romance", count: 38 },
  { name: "Comedy", count: 35 },
  { name: "Horror", count: 28 },
  { name: "Animation", count: 22 },
  { name: "Documentary", count: 18 },
  { name: "Crime", count: 16 },
];

// Hero collage — top essentials of the selected world
const heroItems: Array<{ title: string; score: number }> = [
  { title: "Past Lives", score: 9.2 },
  { title: "The Worst Person", score: 8.8 },
  { title: "Aftersun", score: 9.1 },
  { title: "Drive My Car", score: 8.9 },
  { title: "Decision to Leave", score: 8.7 },
];

// Subgenres — SubgenreExplorer chips
const subgenres: Array<{ name: string; count: number; selected?: boolean }> = [
  { name: "All essentials", count: 84, selected: true },
  { name: "Coming-of-Age", count: 18 },
  { name: "Family Drama", count: 16 },
  { name: "Romance Drama", count: 14 },
  { name: "Slow Burn", count: 12 },
  { name: "Diaspora", count: 9 },
  { name: "Period Drama", count: 8 },
  { name: "Character Study", count: 7 },
];

// Gateway items — StartHerePanel 2x2
const gateways: Array<{ title: string; tags: string[] }> = [
  { title: "Past Lives", tags: ["Slow Burn", "Diaspora"] },
  { title: "Lady Bird", tags: ["Coming-of-Age", "Family"] },
  { title: "Manchester by the Sea", tags: ["Grief", "Brothers"] },
  { title: "Moonlight", tags: ["Triptych", "Identity"] },
];

// Essentials shelf — definitive entries (10 items, horizontally scrolled)
const essentials: Array<{ title: string; score: number }> = [
  { title: "Past Lives", score: 9.2 },
  { title: "Aftersun", score: 9.1 },
  { title: "Drive My Car", score: 8.9 },
  { title: "The Worst Person", score: 8.8 },
  { title: "Decision to Leave", score: 8.7 },
  { title: "Moonlight", score: 8.6 },
  { title: "Lady Bird", score: 8.5 },
  { title: "Manchester by the Sea", score: 8.4 },
  { title: "Phantom Thread", score: 8.3 },
  { title: "Cold War", score: 8.2 },
];

// Hidden gems — under-watched but high signal
const hiddenGems: Array<{ title: string; score: number; tag: string }> = [
  { title: "Petite Maman", score: 8.4, tag: "Coming-of-Age" },
  { title: "Memoria", score: 8.2, tag: "Slow Burn" },
  { title: "After Yang", score: 8.1, tag: "Family Drama" },
  { title: "Showing Up", score: 7.9, tag: "Character Study" },
  { title: "Saint Omer", score: 8.0, tag: "Diaspora" },
  { title: "Pacifiction", score: 7.8, tag: "Slow Burn" },
];

// If-you-liked relationship chains
const chains: Array<{ seed: string; next: string }> = [
  { seed: "Past Lives", next: "Drive My Car" },
  { seed: "Aftersun", next: "Petite Maman" },
  { seed: "Moonlight", next: "Manchester by the Sea" },
  { seed: "Phantom Thread", next: "The Worst Person" },
];

// Curated collections (4-up)
const collections: Array<{
  genre: string;
  title: string;
  description: string;
}> = [
  {
    genre: "Drama",
    title: "Best First Drama Movies",
    description: "Approachable entries that make the genre click quickly.",
  },
  {
    genre: "Drama",
    title: "Essential Drama Canon",
    description: "The definitive works that anchor the whole conversation.",
  },
  {
    genre: "Sci-Fi",
    title: "Deep Sci-Fi Cuts",
    description: "Strong picks beyond the obvious first shelf.",
  },
  {
    genre: "Thriller",
    title: "Thriller Worlds Worth Entering",
    description: "A focused path into another high-performing lane.",
  },
];

const posterGradient = (hex: string) =>
  `linear-gradient(165deg, #0a0810 0%, #1a1624 38%, ${hex}40 76%, ${hex} 100%)`;

// ─── Page ───────────────────────────────────────────────────────────────────
export default function VaporwaveNoirDiscover() {
  return (
    <div
      style={{
        marginInline: "-24px",
        marginTop: "-24px",
        background: BG,
        color: TEXT,
        minHeight: "calc(100vh - 64px)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        backgroundImage: `radial-gradient(ellipse 90% 70% at 50% 0%, ${SELECTED_TYPE_ACCENT}1A, transparent 70%)`,
      }}
    >
      <div
        style={{
          padding: "32px 40px 80px",
          maxWidth: 1440,
          margin: "0 auto",
        }}
      >
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 6,
            borderRadius: 14,
            background: SURFACE,
            border: `1px solid ${RULE}`,
            marginBottom: 24,
            overflowX: "auto",
          }}
        >
          {tabs.map((t) => {
            const a = accent(t.key);
            const isSelected = t.key === SELECTED_TYPE;
            return (
              <button
                key={t.key}
                type="button"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid transparent",
                  background: isSelected
                    ? `linear-gradient(180deg, ${a}1F, ${a}0A)`
                    : "transparent",
                  borderColor: isSelected ? `${a}55` : "transparent",
                  color: isSelected ? a : `${a}99`,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: isSelected
                    ? `inset 0 0 0 1px ${a}33, 0 0 16px ${a}33`
                    : "none",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* HERO — eyebrow, title, dek, scattered poster collage */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "0.92fr 1.08fr",
            gap: 24,
            alignItems: "end",
            minHeight: 470,
            marginBottom: 36,
            position: "relative",
          }}
        >
          <div style={{ paddingBottom: 24, maxWidth: 560 }}>
            <p
              style={{
                fontSize: 11,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: SELECTED_TYPE_ACCENT,
                margin: 0,
                fontWeight: 600,
              }}
            >
              Film discovery engine
            </p>
            <h1
              style={{
                fontFamily: "var(--font-heading), serif",
                fontSize: 64,
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
                fontWeight: 650,
                margin: "12px 0 0",
                textWrap: "balance",
              }}
            >
              Drama{" "}
              <span
                style={{
                  color: SELECTED_TYPE_ACCENT,
                  textShadow: `0 0 28px ${SELECTED_TYPE_ACCENT}80`,
                }}
              >
                Essentials
              </span>
            </h1>
            <p
              style={{
                color: MUTED,
                fontSize: 16,
                lineHeight: 1.55,
                margin: "16px 0 0",
                maxWidth: 480,
              }}
            >
              The films that make drama feel vivid, approachable, and worth
              exploring deeper.
            </p>
          </div>

          {/* Scattered poster collage */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(84px, 1fr))",
              alignItems: "center",
              gap: 6,
              minHeight: 430,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(circle at 50% 52%, ${SELECTED_TYPE_ACCENT}24, transparent 22rem)`,
                pointerEvents: "none",
              }}
            />
            {heroItems.map((item, index) => {
              const elevated = index === 2;
              const rotate = [-7, 4, -2, 6, -5][index] ?? 0;
              const yOffset = index % 2 === 0 ? -40 : 64;
              return (
                <div
                  key={item.title}
                  style={{
                    aspectRatio: "2 / 3",
                    borderRadius: 12,
                    background: posterGradient(SELECTED_TYPE_ACCENT),
                    border: `1px solid ${elevated ? `${SELECTED_TYPE_ACCENT}66` : RULE_STRONG}`,
                    transform: `translateY(${yOffset}px) rotate(${rotate}deg)`,
                    boxShadow: elevated
                      ? `0 24px 56px rgba(0,0,0,0.6), 0 0 36px ${SELECTED_TYPE_ACCENT}55`
                      : "0 14px 30px rgba(0,0,0,0.45)",
                    zIndex: elevated ? 4 : 3 - Math.abs(index - 2),
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: 10,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      color: TEXT,
                      lineHeight: 1.15,
                      textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    style={{
                      margin: "3px 0 0",
                      fontSize: 11,
                      color: TEXT,
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: "var(--font-heading), serif",
                      fontWeight: 600,
                      textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                    }}
                  >
                    {item.score.toFixed(1)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* GENRE RAIL — "Choose a world" */}
        <section style={{ marginBottom: 24 }}>
          <Eyebrow color={SELECTED_TYPE_ACCENT}>Choose a world</Eyebrow>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 4,
              marginTop: 10,
            }}
          >
            {genres.map((g) => (
              <button
                key={g.name}
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: g.selected
                    ? `${SELECTED_TYPE_ACCENT}1A`
                    : SURFACE,
                  color: g.selected ? SELECTED_TYPE_ACCENT : TEXT,
                  border: `1px solid ${g.selected ? `${SELECTED_TYPE_ACCENT}66` : RULE_STRONG}`,
                  fontSize: 13,
                  fontWeight: g.selected ? 600 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: g.selected
                    ? `0 0 16px ${SELECTED_TYPE_ACCENT}40`
                    : "none",
                }}
              >
                {g.name}
                <span
                  style={{
                    fontSize: 11,
                    color: g.selected ? SELECTED_TYPE_ACCENT : MUTED,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {g.count}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* START HERE + SUBGENRE EXPLORER (two-column) */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr 0.85fr",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <Panel accent={SELECTED_TYPE_ACCENT}>
            <Eyebrow color={SELECTED_TYPE_ACCENT}>Start here</Eyebrow>
            <SectionTitle>Gateway films for drama</SectionTitle>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
                marginTop: 16,
              }}
            >
              {gateways.map((g, i) => (
                <div
                  key={g.title}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: 10,
                    borderRadius: 12,
                    background: SURFACE_2,
                    border: `1px solid ${RULE_STRONG}`,
                    borderLeft: `2px solid ${SELECTED_TYPE_ACCENT}`,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 44,
                      height: 60,
                      borderRadius: 6,
                      background: posterGradient(SELECTED_TYPE_ACCENT),
                      border: `1px solid ${SELECTED_TYPE_ACCENT}33`,
                      boxShadow: `0 0 12px ${SELECTED_TYPE_ACCENT}33`,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 600,
                        fontSize: 14,
                        color: TEXT,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {g.title}
                    </p>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: 12,
                        color: MUTED,
                      }}
                    >
                      {g.tags.join(" · ")}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 18,
                      fontFamily: "var(--font-heading), serif",
                      fontWeight: 700,
                      color: MUTED,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel accent={SELECTED_TYPE_ACCENT}>
            <Eyebrow color={SELECTED_TYPE_ACCENT}>Subgenre explorer</Eyebrow>
            <SectionTitle>Go deeper than drama</SectionTitle>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 16,
              }}
            >
              {subgenres.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  style={{
                    padding: "7px 13px",
                    borderRadius: 999,
                    border: `1px solid ${s.selected ? `${SELECTED_TYPE_ACCENT}66` : RULE_STRONG}`,
                    background: s.selected
                      ? `${SELECTED_TYPE_ACCENT}1A`
                      : SURFACE_2,
                    color: s.selected ? SELECTED_TYPE_ACCENT : TEXT,
                    fontSize: 12,
                    fontWeight: s.selected ? 600 : 500,
                    cursor: "pointer",
                    boxShadow: s.selected
                      ? `0 0 14px ${SELECTED_TYPE_ACCENT}40`
                      : "none",
                  }}
                >
                  {s.name}{" "}
                  <span
                    style={{
                      fontSize: 11,
                      color: s.selected ? SELECTED_TYPE_ACCENT : MUTED,
                      marginLeft: 4,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {s.count}
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </section>

        {/* ESSENTIAL X — horizontal poster shelf with rank pills */}
        <section style={{ marginBottom: 28 }}>
          <Eyebrow color={SELECTED_TYPE_ACCENT}>Definitive entries</Eyebrow>
          <SectionTitle>Essential Drama</SectionTitle>
          <div
            style={{
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: "172px",
              gap: 12,
              marginTop: 16,
              overflowX: "auto",
              paddingBottom: 8,
            }}
          >
            {essentials.map((item, index) => (
              <div key={item.title} style={{ minWidth: 0 }}>
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "2 / 3",
                    borderRadius: 12,
                    background: posterGradient(SELECTED_TYPE_ACCENT),
                    border: `1px solid ${RULE_STRONG}`,
                    boxShadow: `0 10px 28px rgba(0,0,0,0.5), 0 0 18px ${SELECTED_TYPE_ACCENT}1F`,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      width: 30,
                      height: 26,
                      borderRadius: 6,
                      background: "rgba(8,8,11,0.7)",
                      backdropFilter: "blur(6px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: SELECTED_TYPE_ACCENT,
                      border: `1px solid ${SELECTED_TYPE_ACCENT}40`,
                    }}
                  >
                    {index + 1}
                  </div>
                </div>
                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: 13,
                    fontWeight: 600,
                    color: TEXT,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 11,
                    color: MUTED,
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: "var(--font-heading), serif",
                    fontWeight: 600,
                  }}
                >
                  {item.score.toFixed(1)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* HIDDEN GEMS + IF YOU LIKED (two-column) */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "0.9fr 1.1fr",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <Panel accent={SELECTED_TYPE_ACCENT}>
            <Eyebrow color={SELECTED_TYPE_ACCENT}>Worth digging for</Eyebrow>
            <SectionTitle>Hidden Gems</SectionTitle>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginTop: 16,
              }}
            >
              {hiddenGems.map((g) => (
                <div key={g.title}>
                  <div
                    style={{
                      aspectRatio: "2 / 3",
                      borderRadius: 10,
                      background: posterGradient(SELECTED_TYPE_ACCENT),
                      border: `1px solid ${RULE_STRONG}`,
                      boxShadow: `0 6px 20px rgba(0,0,0,0.4)`,
                    }}
                  />
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 12,
                      fontWeight: 600,
                      color: TEXT,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {g.title}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 10,
                      color: SELECTED_TYPE_ACCENT,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    {g.tag}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel accent={SELECTED_TYPE_ACCENT}>
            <Eyebrow color={SELECTED_TYPE_ACCENT}>
              Recommendation pathways
            </Eyebrow>
            <SectionTitle>If You Liked...</SectionTitle>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 16,
              }}
            >
              {chains.map((c) => (
                <div
                  key={`${c.seed}-${c.next}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr auto 44px 1fr",
                    gap: 10,
                    alignItems: "center",
                    padding: 10,
                    borderRadius: 12,
                    background: SURFACE_2,
                    border: `1px solid ${RULE_STRONG}`,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 44,
                      height: 60,
                      borderRadius: 6,
                      background: posterGradient(SELECTED_TYPE_ACCENT),
                      border: `1px solid ${SELECTED_TYPE_ACCENT}33`,
                    }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      fontSize: 13,
                      color: TEXT,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.seed}
                  </p>
                  <span
                    style={{
                      fontSize: 11,
                      color: SELECTED_TYPE_ACCENT,
                      fontWeight: 600,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                  >
                    then
                  </span>
                  <div
                    aria-hidden
                    style={{
                      width: 44,
                      height: 60,
                      borderRadius: 6,
                      background: posterGradient(SELECTED_TYPE_ACCENT),
                      border: `1px solid ${SELECTED_TYPE_ACCENT}33`,
                    }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      fontSize: 13,
                      color: TEXT,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.next}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        {/* CURATED COLLECTIONS (4-up) */}
        <section>
          <Eyebrow color={SELECTED_TYPE_ACCENT}>Curated collections</Eyebrow>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginTop: 12,
            }}
          >
            {collections.map((c) => (
              <div
                key={c.title}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 156,
                  padding: 16,
                  borderRadius: 14,
                  background: SURFACE,
                  border: `1px solid ${RULE_STRONG}`,
                  borderLeft: `2px solid ${SELECTED_TYPE_ACCENT}`,
                  cursor: "pointer",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: SELECTED_TYPE_ACCENT,
                    fontWeight: 700,
                  }}
                >
                  {c.genre}
                </p>
                <p
                  style={{
                    margin: "12px 0 0",
                    fontFamily: "var(--font-heading), serif",
                    fontSize: 17,
                    fontWeight: 650,
                    letterSpacing: "-0.015em",
                    lineHeight: 1.25,
                    color: TEXT,
                  }}
                >
                  {c.title}
                </p>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 13,
                    color: MUTED,
                    lineHeight: 1.5,
                  }}
                >
                  {c.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Panel({
  accent,
  children,
}: {
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${RULE}`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: 18,
        padding: 22,
        boxShadow: `0 8px 24px rgba(0,0,0,0.35), -10px 0 32px -18px ${accent}99`,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 11,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color,
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "8px 0 0",
        fontFamily: "var(--font-heading), serif",
        fontSize: 26,
        letterSpacing: "-0.02em",
        fontWeight: 650,
        lineHeight: 1.15,
        color: TEXT,
      }}
    >
      {children}
    </h2>
  );
}
