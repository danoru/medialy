/**
 * One-off debug script: prints a full Medialy Match breakdown for the
 * top recommendations for a given user.
 *
 *   pnpm tsx scripts/explain-recommendations.ts [userId] [limit]
 *
 * Defaults: userId = usr_default, limit = 10.
 */
import { prisma } from "@/lib/prisma";
import { MEDIALY_MATCH_WEIGHTS } from "@/lib/scoring/config";
import { getRecommendations } from "@/lib/recommendations";

async function main() {
  const userId = process.argv[2] ?? "usr_default";
  const limit = Number(process.argv[3] ?? 10);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`No user with id "${userId}"`);
    process.exit(1);
  }

  const recs = await getRecommendations(limit, {}, userId);

  console.log(
    `\nTop ${recs.length} recommendations for ${user.name ?? user.email ?? userId}\n`,
  );
  console.log(
    `Weights: ${Object.entries(MEDIALY_MATCH_WEIGHTS)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}\n`,
  );

  for (const [index, rec] of recs.entries()) {
    console.log(
      `${index + 1}. ${rec.media.title} — ${rec.score}% (confidence ${(rec.confidence ?? 0).toFixed(2)})`,
    );
    for (const e of rec.explanations ?? []) {
      const bar = "█".repeat(Math.round(e.rawValue / 10)).padEnd(10, "·");
      console.log(
        `   ${e.label.padEnd(22)} raw=${String(e.rawValue).padStart(3)} × w=${e.weight.toFixed(2)} = +${String(e.contribution).padStart(2)}  [${bar}]`,
      );
      if (e.detail) console.log(`      ↳ ${e.detail}`);
    }
    console.log();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
