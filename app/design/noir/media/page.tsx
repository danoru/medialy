import Link from "next/link";

export const metadata = { title: "Media detail · Vaporwave Noir" };

// ─── Palette (mirror /design/noir) ──────────────────────────────────────────
const BG = "#0A0810";
const SURFACE = "#13101A";
const TEXT = "#F4EEFA";
const MUTED = "#8A8395";
const RULE = "rgba(255,255,255,0.05)";

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

// ─── Representative item ────────────────────────────────────────────────────
const item = {
  title: "Dune: Part Two",
  year: 2024,
  type: "MOVIE" as MType,
  status: "Completed",
  favorite: true,
  match: 96,
  refined: 9.2, // computedPersonalScore
  community: 8.4, // communityScore
  consensus: 8.6, // computedConsensusScore
  raterCount: 142,
  synopsis:
    "Paul Atreides unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the known universe, he endeavors to prevent a terrible future only he can foresee.",
  genres: ["Sci-Fi", "Drama", "Epic"],
  tags: ["Desert", "Political", "Slow-burn", "Adapted from novel", "Visually arresting"],
  externalRatings: [
    { source: "Metacritic", score: 79, scale: 100 },
    { source: "Rotten Tomatoes", score: 92, scale: 100 },
    { source: "IMDb", score: 8.7, scale: 10 },
    { source: "Letterboxd", score: 4.4, scale: 5 },
  ],
  credits: [
    { name: "Denis Villeneuve", role: "Director" },
    { name: "Timothée Chalamet", role: "Paul Atreides" },
    { name: "Zendaya", role: "Chani" },
    { name: "Rebecca Ferguson", role: "Lady Jessica" },
    { name: "Javier Bardem", role: "Stilgar" },
    { name: "Austin Butler", role: "Feyd-Rautha" },
  ],
  comparisonHistory: [
    { against: "Interstellar", result: "won", when: "2 weeks ago" },
    { against: "Blade Runner 2049", result: "lost", when: "1 month ago" },
    { against: "Arrival", result: "won", when: "1 month ago" },
    { against: "Tenet", result: "won", when: "2 months ago" },
  ],
};

const posterGradient = (hex: string) =>
  `linear-gradient(165deg, #0a0810 0%, #1a1624 35%, ${hex}40 75%, ${hex} 100%)`;

const a = accent(item.type);

// ─── Page ───────────────────────────────────────────────────────────────────
export default function MediaDetailMockup() {
  return (
    <div
      style={{
        marginInline: "-24px",
        marginTop: "-24px",
        background: BG,
        color: TEXT,
        minHeight: "calc(100vh - 64px)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        backgroundImage: `radial-gradient(ellipse 80% 50% at 20% 0%, ${a}18, transparent 70%)`,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 40px 0" }}>
        <Link
          href="/design/noir"
          style={{
            color: MUTED,
            textDecoration: "none",
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          ← Dashboard mockup
        </Link>
      </div>

      {/* HERO — poster + meta */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 40px 0" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "340px 1fr",
            gap: 48,
            marginBottom: 48,
          }}
        >
          {/* Poster */}
          <div
            style={{
              aspectRatio: "2 / 3",
              background: posterGradient(a),
              borderRadius: 16,
              border: `1px solid ${RULE}`,
              borderLeft: `2px solid ${a}`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, transparent 50%, rgba(10,8,16,0.85) 100%)",
              }}
            />
            <p
              style={{
                position: "absolute",
                bottom: 16,
                left: 18,
                margin: 0,
                fontSize: 10,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: a,
              }}
            >
              {label(item.type)}
            </p>
          </div>

          {/* Meta */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <Pill text={label(item.type)} accent={a} solid />
              <Pill text={item.status} accent={MUTED} />
              {item.favorite ? <Pill text="★ Favorite" accent="#FFD56B" /> : null}
            </div>
            <h1
              style={{
                fontFamily: "var(--font-heading), serif",
                fontSize: 72,
                margin: 0,
                letterSpacing: "-0.03em",
                fontWeight: 650,
                lineHeight: 1,
              }}
            >
              {item.title}
            </h1>
            <p
              style={{
                fontSize: 16,
                color: MUTED,
                margin: "16px 0 0",
                letterSpacing: "0.04em",
              }}
            >
              {item.year} ·{" "}
              {item.credits
                .filter((c) => c.role === "Director")
                .map((c) => c.name)
                .join(", ")}
            </p>

            {/* Match score block */}
            <div
              style={{
                marginTop: 28,
                display: "flex",
                alignItems: "center",
                gap: 28,
                padding: "20px 24px",
                background: SURFACE,
                border: `1px solid ${RULE}`,
                borderLeft: `2px solid ${a}`,
                borderRadius: 16,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color: MUTED,
                    margin: 0,
                  }}
                >
                  Medialy Match
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-heading), serif",
                    fontSize: 56,
                    margin: "4px 0 0",
                    color: a,
                    textShadow: `0 0 28px ${a}50`,
                    letterSpacing: "-0.03em",
                    fontWeight: 650,
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {item.match}%
                </p>
              </div>
              <div style={{ height: 56, width: 1, background: RULE }} />
              <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.5, margin: 0, maxWidth: 280 }}>
                You loved <em style={{ color: TEXT, fontStyle: "normal" }}>Arrival</em>,{" "}
                <em style={{ color: TEXT, fontStyle: "normal" }}>Blade Runner 2049</em>, and similar
                tonally-dense sci-fi.
              </p>
            </div>

            {/* Action bar */}
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button
                style={{
                  background: a,
                  color: BG,
                  border: 0,
                  borderRadius: 999,
                  padding: "12px 24px",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: `0 0 24px ${a}55`,
                }}
              >
                ★ Rate it
              </button>
              <button
                style={{
                  background: "transparent",
                  color: TEXT,
                  border: `1px solid ${RULE}`,
                  borderRadius: 999,
                  padding: "12px 24px",
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Run a comparison
              </button>
              <button
                style={{
                  background: "transparent",
                  color: MUTED,
                  border: `1px solid ${RULE}`,
                  borderRadius: 999,
                  padding: "12px 16px",
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ⋯
              </button>
            </div>
          </div>
        </div>

        {/* SCORE BREAKDOWN */}
        <SectionTitle>Score breakdown</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 40,
          }}
        >
          <ScoreTile
            label="Refined"
            value={item.refined.toFixed(1)}
            sub="Your blended personal score"
            colorHex={a}
          />
          <ScoreTile
            label="Community"
            value={item.community.toFixed(1)}
            sub={`Averaged across ${item.raterCount} Medialy users`}
            colorHex={a}
            muted
          />
          <ScoreTile
            label="Consensus"
            value={item.consensus.toFixed(1)}
            sub={`${item.externalRatings.length} external sources, weighted`}
            colorHex={a}
            muted
          />
        </div>

        {/* EXTERNAL RATINGS */}
        <SectionTitle>External ratings</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 40,
          }}
        >
          {item.externalRatings.map((r) => (
            <div
              key={r.source}
              style={{
                background: SURFACE,
                border: `1px solid ${RULE}`,
                borderRadius: 14,
                padding: 18,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: MUTED,
                  margin: 0,
                }}
              >
                {r.source}
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontFamily: "var(--font-heading), serif",
                  fontSize: 28,
                  fontWeight: 650,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                  color: TEXT,
                }}
              >
                {r.score}
                <span style={{ fontSize: 14, color: MUTED, fontWeight: 400, marginLeft: 4 }}>
                  /{r.scale}
                </span>
              </p>
            </div>
          ))}
        </div>

        {/* SYNOPSIS + COMPARISON HISTORY side-by-side */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, marginBottom: 40 }}>
          <div>
            <SectionTitle>Synopsis</SectionTitle>
            <div
              style={{
                background: SURFACE,
                border: `1px solid ${RULE}`,
                borderLeft: `2px solid ${a}`,
                borderRadius: 16,
                padding: 28,
              }}
            >
              <p style={{ color: "#cfcad6", fontSize: 16, lineHeight: 1.65, margin: 0 }}>
                {item.synopsis}
              </p>
            </div>
          </div>

          <div>
            <SectionTitle>Comparison history</SectionTitle>
            <div
              style={{
                background: SURFACE,
                border: `1px solid ${RULE}`,
                borderRadius: 16,
                padding: 6,
              }}
            >
              {item.comparisonHistory.map((c, i, arr) => (
                <div
                  key={`${c.against}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 16px",
                    borderLeft: `2px solid ${c.result === "won" ? a : MUTED}`,
                    borderTopLeftRadius: i === 0 ? 12 : 0,
                    borderBottomLeftRadius: i === arr.length - 1 ? 12 : 0,
                    borderBottom: i < arr.length - 1 ? `1px solid ${RULE}` : "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.25em",
                      textTransform: "uppercase",
                      color: c.result === "won" ? a : MUTED,
                      width: 50,
                    }}
                  >
                    {c.result === "won" ? "Won" : "Lost"}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>vs. {c.against}</span>
                  <span style={{ color: MUTED, fontSize: 12 }}>{c.when}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GENRES + TAGS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 24, marginBottom: 40 }}>
          <div>
            <SectionTitle>Genres</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.genres.map((g) => (
                <Pill key={g} text={g} accent={a} />
              ))}
            </div>
          </div>
          <div>
            <SectionTitle>Tags</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.tags.map((t) => (
                <Pill key={t} text={t} accent={MUTED} />
              ))}
            </div>
          </div>
        </div>

        {/* CREDITS */}
        <SectionTitle>Credits</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 80,
          }}
        >
          {item.credits.map((c) => (
            <div
              key={c.name}
              style={{
                background: SURFACE,
                border: `1px solid ${RULE}`,
                borderRadius: 14,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 99,
                  background: `linear-gradient(135deg, ${BG}, ${a}80)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT,
                  border: `1px solid ${a}40`,
                  flexShrink: 0,
                }}
              >
                {c.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{c.name}</p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 11,
                    color: MUTED,
                    letterSpacing: "0.05em",
                  }}
                >
                  {c.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 12,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color: MUTED,
        margin: "0 0 14px",
        fontWeight: 600,
      }}
    >
      {children}
    </h2>
  );
}

function Pill({
  text,
  accent: c,
  solid,
}: {
  text: string;
  accent: string;
  solid?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: solid ? BG : c,
        background: solid ? c : "transparent",
        border: solid ? "none" : `1px solid ${c}60`,
        padding: "5px 12px",
        borderRadius: 999,
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );
}

function ScoreTile({
  label,
  value,
  sub,
  colorHex,
  muted,
}: {
  label: string;
  value: string;
  sub: string;
  colorHex: string;
  muted?: boolean;
}) {
  const c = muted ? TEXT : colorHex;
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${RULE}`,
        borderLeft: `2px solid ${muted ? "rgba(255,255,255,0.15)" : colorHex}`,
        borderRadius: 16,
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {!muted ? (
        <div
          style={{
            position: "absolute",
            bottom: -50,
            right: -50,
            width: 160,
            height: 160,
            background: `radial-gradient(circle, ${colorHex}25, transparent 70%)`,
            filter: "blur(22px)",
          }}
        />
      ) : null}
      <p
        style={{
          fontSize: 10,
          letterSpacing: "0.3em",
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
          fontSize: 56,
          margin: "10px 0 6px",
          fontWeight: 650,
          letterSpacing: "-0.04em",
          color: c,
          textShadow: muted ? "none" : `0 0 28px ${colorHex}45`,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
        <span style={{ fontSize: 18, color: MUTED, fontWeight: 400, marginLeft: 4 }}>/10</span>
      </p>
      <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{sub}</p>
    </div>
  );
}
