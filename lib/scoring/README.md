# Scoring

All ranking math lives here. Modules are kept free of React/Next/Prisma so they can be unit-tested in node (see `ratings.test.ts`). Every magic number lives in `config.ts` — if you find a hardcoded constant elsewhere in this directory, move it there.

There are three independent score families per `MediaItem`:

- **Personal score** — how much *this user* likes the item. Blends explicit rating + pairwise (Elo) + confidence.
- **Consensus score** — what *the world* thinks. Aggregates external ratings (Metacritic, IMDB, Letterboxd, Goodreads, BGG, etc.) with source-trust weights.
- **Pairwise (Elo) score** — relational ranking learned from `/compare` votes.

These three feed into:

- **Medialy Match** — taste-only recommendation score (0–100) for items the user *hasn't consumed yet*.
- **Rating compatibility** — pairwise user-vs-user similarity, used in `/friends` and to weight friend signals.

---

## Personal score (`personalScore.ts`)

For each user/item pair we resolve a single `computedPersonalScore` from up to three inputs:

1. **Explicit rating** (0–10) — the user's own number, if they've given one.
2. **Pairwise rating** — Elo score (0–100 scale) collapsed back to 0–10 using `PAIRWISE.uiRange`.
3. **Pairwise confidence** — grows with `comparisonCount` (see `PAIRWISE.confidenceBuckets`).

Blend:

```
w = PERSONAL_SCORE.relationalWeight × pairwiseConfidence
score = explicitRating × (1 − w) + pairwiseRating × w
```

If there's no explicit rating, score = pairwise rating (with a damped confidence floor). If neither exists, score = null.

Confidence rules:
- Explicit rating present → confidence has a floor of `PERSONAL_SCORE.explicitRatingConfidenceFloor` (0.55).
- Pairwise-only → confidence is multiplied by `PERSONAL_SCORE.pairwiseOnlyConfidenceDamping` (0.6).

**Call `recomputeMediaScores(mediaId, tx?)` from `recompute.ts` after any rating, comparison, or external-rating mutation.** The denormalized columns assume freshness.

---

## Pairwise / Elo (`pairwise.ts`)

Classic Elo with two twists:

1. **K-factor decay.** New items move fast; settled items move slowly. The K multiplier walks down through `PAIRWISE.kDecay` as `comparisonCount` grows (1.0 at 0 comparisons → 0.35 at 25+).

2. **Prior-blended expected outcome.** Instead of pure Elo-vs-Elo expectation, we blend each item's effective strength from `personalRating + consensus + pairwise` (weights in `PAIRWISE.priorBlend`). This means upsets — a low-rated item beating a high-rated one — register as real signal rather than noise. Each 1.0 difference on the 0–10 effective scale becomes `PAIRWISE.priorSpreadPerRatingPoint` (60) Elo points.

Initial Elo: 1000. UI range: 850–1350 collapses to 0–10.

---

## Consensus score (`consensus.ts`)

Aggregates external ratings into a single 0–10 critic consensus + a 0–1 confidence.

Per source:
- **Trust weight** (`SOURCE_TRUST_WEIGHTS`) — critic aggregates outrank mass-audience scores (Metacritic 1.0 vs RT Audience 0.55) to limit brigading. Sources not listed default to 0.5.
- **Media-type applicability** (`SOURCE_MEDIA_APPLICABILITY`) — Goodreads doesn't vote on video games. `null` means "applies everywhere".
- **Recency decay** — linear from 1.0 to `CONSENSUS.recency.floor` over `staleAfterDays`. Anything older stays at the floor.
- **Outlier trim** — once you have ≥`outlierTrim.minSourcesForTrim` sources, any rating ≥`deviationFromMedian` away from the median gets multiplied by `trimMultiplier` (0.35). One wild source can't drag the mean.

Confidence:
- **Source count confidence** — `count / sourceCountDenominator`, clamped to `[sourceConfidenceFloor, 1]`. More sources = more confidence.
- **Agreement confidence** — `1 − variance / agreementVarianceDivisor`, clamped to `[agreementConfidenceFloor, 1]`. High disagreement drops confidence.

Final consensus confidence is the product of the two.

---

## Medialy Match (`medialyMatch.ts`)

The recommendation score, **0–100**. Personal score is intentionally absent — by the time an item reaches this function it's a candidate the user hasn't consumed (filtered upstream in `eligibility.ts`), so "how much have you already shown you like it" is meaningless. Demonstrated taste flows in via the affinity signals.

Five weighted signals, summing to 1.0 (`MEDIALY_MATCH_WEIGHTS`):

| Signal | Weight | What it measures |
|---|---|---|
| Genre affinity | 0.20 | Per-genre shrunk-mean rating across your highly-rated library |
| Tag affinity | 0.15 | Same, on tags (including country) |
| Contributor affinity | 0.15 | Same, on directors/creators/devs/publishers (with per-role multiplier) |
| Friend signal | 0.30 | Followers' ratings, weighted by per-follower taste compatibility |
| Critic consensus | 0.20 | External critic score (lifted from the consensus pipeline) |

Bucket targets: **50% taste affinity / 30% friends / 20% critics**.

### Affinity buckets (`affinity.ts`, computed in `lib/recommendations.ts:getAffinityMaps`)

This is the part that recently changed; it's where most of the differentiation comes from.

**Step 1 — gather.** Walk the user's highly-rated pool (`COMPLETED` and either `computedPersonalScore ≥ 8` or `personalRating ≥ 8` or `pairwiseScore ≥ 1150`). For each item, accumulate `{ sum: rating, count: 1 }` into per-feature maps for genres, tags, and contributors. Also track `globalMean` = average rating across the entire pool.

**Step 2 — shrink.** For every feature, compute a **Bayesian-shrunk mean** that pulls small samples toward the global mean:

```
shrunkMean(g) = (sumRatings(g) + shrinkageK × globalMean) / (count(g) + shrinkageK)
contribution(g) = max(0, (shrunkMean(g) − neutralPivot) × scale)
```

With `shrinkageK=5`, `neutralPivot=6.5`, `scale=30`:

| Genre | Items × mean | Shrunk mean | Contribution |
|---|---|---|---|
| Drama | 36 × 8.3 | ~8.18 | ~50 |
| Cyberpunk | 2 × 9.5 | ~8.07 | ~47 |
| Horror | 8 × 4.0 | ~4.85 | **0** (floored) |
| Unrated | 0 | (defaults to globalMean) | 0 |

This is the user-requested "average score per genre" approach, with shrinkage so a single 10/10 doesn't dominate.

**Floored at zero** — disliked features don't actively demote a candidate, they just stop contributing. Revisit if you want signed negative evidence.

Tags and contributors use the same formula. Contributors then get a *post*-shrinkage multiplier:
- `ROLE_WEIGHT`: DIRECTOR/CREATOR=1.0, DEVELOPER=0.55, PUBLISHER=0.35.
- `CONTRIBUTOR_BUCKET_SCALE=0.6` to keep contributor contributions on the same order as tags.

Tags get `TAG_BUCKET_SCALE = TAG_WEIGHT/GENRE_WEIGHT = 0.3` for the same reason.

**Step 3 — saturate.** Sum each candidate's per-feature contributions and pass through a BM25-style soft saturation:

```
score = 100 × raw / (raw + saturationK)
```

With per-bucket `saturationK` from `AFFINITY_TUNING.saturationK` (genre=60, tag=30, contributor=25):

| Raw sum | Genre score (k=60) |
|---|---|
| 30 | 33 |
| 60 | 50 (half-saturation point) |
| 180 | 75 |
| 540 | 90 |
| 1000+ | approaches but never reaches 100 |

This replaced a hard `clamp(0,100)` that was pegging genre at 100 for every candidate. With saturation, two niche-genre matches can compound past what one popular genre reaches alone, and candidates never tie at exactly 100.

### Country detail (`buildCountryDetail`)

Country still flows through tag affinity for scoring, but we produce a dedicated detail string ("Shares country (Japan) with 2 of your favorites") when a candidate has a non-US country tag matching one in your favorites. `COUNTRY_AFFINITY_EXCLUSIONS` excludes US since most libraries are US-heavy by default.

### Contributor detail (`buildContributorDetail`)

Picks the contributor on the candidate with the highest affinity weight and produces "Director Akira Kurosawa — you've rated 3 of their works highly" or, for a single match, "...you rated Yojimbo 10/10".

### Friend signal (`computeFriendSignal` in `recommendations.ts`)

For each candidate, gather all followers who rated/completed it. Per follower, compute a per-item boost:

```
ratingBoost = max(0, (rating − 6) × 10)
statusBoost = COMPLETED ? 8 : WATCHLIST ? 5 : 0
perFollower = ratingBoost + statusBoost
```

Then weight each follower's contribution by their **compatibility** with the viewer (0–100 → 0–1), where compatibility = `calculateRatingCompatibility(overlapping rated items)`. So a 95%-compatible friend's 9/10 counts ~3× as much as a 30%-compatible friend's. Followers with no overlap default to 50% (neutral).

```
friendAffinity = sum(perFollower × weight) / sum(weight)
```

### Confidence (signal coverage)

Each `Recommendation` carries a 0–1 `confidence` separate from `score`. It answers a different question: not "how good a match is this?" but "**how well-sourced is the call?**"

Computed as the sum of `MEDIALY_MATCH_WEIGHTS` for signals whose raw value was > 0. A critic-only candidate caps at 0.20; one backed by every signal hits 1.00. Used as a tiebreaker when two candidates score identically.

### What "100%" requires

A 100% match requires:
- Genre + tag + contributor affinities all saturated (multiple strong matches per bucket), AND
- Multiple high-compatibility friends who rated it well, AND
- Critic consensus near 10/10.

In practice 60–80% is a *very* strong match; anything 90+ is rare. The ceiling exists; it's just not cheap to hit.

---

## Top 10 & cross-surface rankings (`lib/db/dashboard.ts`, `lib/insights.ts`, `app/discover/page.tsx`)

Three surfaces rank items by a blended quality score: Overall Top 10 (dashboard), Insights standouts, and Discover. Historically they were naive arithmetic means — a single user rating of 10 with no critic data would rank #1 over an item with five user ratings averaging 9 plus broad critic consensus.

All three now use **IMDB Top 250-style Bayesian shrinkage** (`bayesianShrunkMean` in `affinity.ts`):

```
shrunkMean = (v × observed + k × prior) / (v + k)
```

- `observed` = the per-item value (community avg, consensus score, or personal score)
- `v` = evidence count (user voters, critic sources, or pairwise comparisons + rating presence)
- `k` = the per-signal shrinkage strength from `TOP_RANKING.shrinkageK`
- `prior` = the population mean (global community avg, global consensus avg, or the user's personal mean)

Items with thin evidence are pulled toward the prior in proportion to how thin they are. With prior=7.5 and k=3, a 1-vote 10 lands at ~8.13; a 100-vote 9 lands at ~8.99.

### Overall Top 10 (`dashboardQualityScore` in `lib/db/dashboard.ts`)

Cross-user objective ranking. Shrinks community average toward `globalCommunityMean` (with `shrinkageK.user=3`) and consensus toward `globalConsensusMean` (with `shrinkageK.source=2`), then averages the present components. Tiebreaker: total evidence count (more votes/sources wins), then alphabetical.

Defensive default: if `computedConsensusScore` exists but we have no source count for the item, we treat it as 1 source. Better to under-trust than to silently substitute the prior.

### Insights standouts (`mediaQualityScore` in `lib/insights.ts`)

Per-user ranking. Same shape but with the **user's** personal score in place of community avg. Personal-side evidence = `comparisonCount + (personalRating ? 3 : 0)` — pairwise votes and explicit rating both count, with the rating worth ~3 comparisons of evidence (matches `PAIRWISE.confidenceBuckets`). Uses `shrinkageK.personal=3`.

### Discover (`discoverRankScore` in `app/discover/page.tsx`)

The `discoverScore()` function still returns the raw value for *display* (so users see their actual rating, not a shrunk version). `discoverRankScore(item, prior)` is the ranking-time variant — wraps `discoverScore` in Bayesian shrinkage with `shrinkageK.personal` and the discover-pool mean as prior. All sort comparators inside the page now use the rank variant; the displayed "8.5" badge still uses the raw.

### Debugging

`pnpm tsx scripts/explain-top10.ts [mediaType] [limit]` — prints side-by-side comparison of the old naive average vs. the new shrunk score for each item, including vote/source counts. Use this to confirm rankings shift the way you expect when tuning `TOP_RANKING.shrinkageK`.

---

## Comparison relevance (`comparisonRelevance.ts`)

Which Elo matchups to surface on `/compare`. Score is 0–1, weighted by `COMPARISON_RELEVANCE` (genre, tag, rating proximity, pairwise proximity, year proximity, plus a base floor). Cross-media-type pairs return 0 — we don't compare movies to video games.

The relevance score then maps to **Elo weight** via:

```
eloWeight = COMPARISON_RELEVANCE.eloWeightFloor + (1 − floor) × relevance
```

So even low-relevance comparisons still update the Elo (at the floor), but high-relevance comparisons swing more.

---

## Rating compatibility (`compatibility.ts`)

Pairwise user-vs-user similarity. Given overlapping rated items, compute average per-item rating distance and convert:

```
compatibility = max(0, 100 − averageDistance × RATING_COMPATIBILITY.ratingDistancePenalty)
```

With `ratingDistancePenalty=12`: a 1-point average gap → 88; a 5-point average gap → 40.

Used in `/friends` and as the per-follower weight in Medialy Match's friend signal.

---

## Hidden Gems / badges (`HIDDEN_GEM`, `BADGE_THRESHOLDS`)

`HIDDEN_GEM` blends a quality score (max of personal/consensus/pairwise normalized) with obscurity and confidence. Items above `badgeThreshold` (0.65) earn the badge; items below `minConfidence` (0.5) don't qualify regardless of quality.

`BADGE_THRESHOLDS` defines the cut-offs for the various flavour badges (Sleeper Hit, Polarizing, Cold Take, Hot Take Failed, Friend-Favorite Untouched).

---

## Debugging recommendations

Run `pnpm tsx scripts/explain-recommendations.ts [userId] [limit]` to print the full per-signal breakdown for the top N recommendations. Output shows raw value, weight, and contribution for each of the five signals plus the detail string (which contributor matched, which country, etc.).

---

## Where to change what

| Change | File |
|---|---|
| Tune Medialy Match weights | `config.ts:MEDIALY_MATCH_WEIGHTS` |
| Tune affinity shrinkage / saturation | `config.ts:AFFINITY_TUNING` |
| Tune Top 10 / Insights / Discover shrinkage | `config.ts:TOP_RANKING` |
| Tune Elo K-factor or confidence | `config.ts:PAIRWISE` |
| Tune source trust / applicability | `config.ts:SOURCE_TRUST_WEIGHTS`, `SOURCE_MEDIA_APPLICABILITY` |
| Add a new affinity bucket | `recommendations.ts:getAffinityMaps` + corresponding signal in `medialyMatch.ts` + weight in `config.ts` |
| Change role multipliers (director vs publisher) | `recommendations.ts:ROLE_WEIGHT` |
| Add a country to the exclusion list | `recommendations.ts:COUNTRY_AFFINITY_EXCLUSIONS` |
