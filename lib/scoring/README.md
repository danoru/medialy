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
2. **Pairwise rating** — Elo score collapsed back to 0–10 using `PAIRWISE.uiRange` (750–1250 → 0–10; neutral 1000 → 5.0).
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

Initial Elo: 1000. UI range: 750–1250 collapses to 0–10, centered so the 1000 starting score (a never-compared / break-even item) maps to a neutral 5.0.

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

## Medialy Match (v2) — `recommendationV2.ts`

The live recommendation engine, wired through `lib/recommendations.ts:getRecommendations` → `lib/recommendations-v2.ts:getRecommendationsV2`. Replaces the affinity/friend/consensus blend described further down (`getRecommendationsV1`, kept for comparison).

Every signal answers "how much will this viewer like the candidate?" as a 0–100 value centered on 50 (neutral), plus a 0–1 reliability saying how much evidence backs it. Unknown (`value: null`, reliability 0) is different from neutral (`value: 50`): an unknown signal moves nothing and adds no confidence, a neutral one adds confidence while moving nothing.

```
score = 50 + Σ(weightᵢ × reliabilityᵢ × (valueᵢ − 50))
confidence = Σ(weightᵢ × reliabilityᵢ)
```

### The six signals (`RECOMMENDATION_V2.weights`)

| Signal | Weight | What it measures |
|---|---:|---|
| Similarity | 0.25 | Nearest rated titles ("because you rated X"), cosine over genre/tag/credit/country vectors |
| Genre | 0.05 | Signed per-medium genre profile |
| Tag | 0.04 | Signed per-medium approved-tag profile |
| Contributor | 0.06 | Signed per-medium director/creator/developer/publisher profile |
| Friends | 0.25 | Followers' ratings, centered on each friend's own baseline |
| Consensus | 0.35 | External critics, centered on the catalog's typical 7 |

Weights were chosen by the holdout sweep of September 21, 2026 (see below); critics carry the most weight because for the two largest histories they were the best single predictor, and the personal signals add most where taste and critics part ways.

**Similarity** (`similaritySignal`) — the candidate's `RECOMMENDATION_V2.similarity.neighbours` (20) nearest same-medium rated titles by cosine similarity (`cosine ≥ minSimilarity`), weighted by squared similarity × example weight. The value is the weighted mean of those neighbours' residuals (rating minus the viewer's medium baseline, in points, clamped ±50). When same-medium reliability falls below `crossMediumBelow` (0.3), titles from other media are consulted too through a portable vector (genres plus theme/mood/country tags only), at `crossMediumFactor` (0.4) reliability. Cosine normalization means a title with more tags gets no extra credit.

**Genre / tag / contributor** (`featureSignal`) — signed per-medium feature profiles built in `buildTasteProfiles`. Each rated title's residual is added to every genre/tag/contributor-role it carries. A candidate's value is the reliability-weighted mean of its *known* features' residuals; reliability grows both with how well-supported each known feature is (`featurePrior`) and with how many of the candidate's features are known at all (`featureBreadthPrior`) — so a title whose features you have never rated moves the score little, and three loved genres beat one. Unknown features lower reliability instead of disappearing.

**Friends** (`friendSignal`) — each followed user's opinion of the candidate, centered on *that friend's own* usual rating in the medium (`buildFriendBaselines`), not a flat neutral. Compatibility is shrunk toward neutral by shared-rating overlap (`overlapPrior`); completing or watchlisting without a rating counts only as weak interest (`statusOnlyInterest`), never stacked on top of a rating.

**Consensus** — critics, centered on `consensusNeutral` (7, the catalog's typical critic score, not 5) at `consensusPointScale` (20) points per critic point away from it; reliability is the consensus pipeline's own confidence.

### Calibration — what Match now means (`calibration.ts`, `MATCH_CALIBRATION`)

The raw 0–100 score is not itself a probability. `calibratedMatch` maps it through a logistic curve fitted offline (`npm run recommendations:evaluate -- --all`) on held-out ratings, so the displayed **Match** means *"the chance you rate this title above your own average"* — the same meaning for every viewer and medium:

```
probability = sigmoid(MATCH_CALIBRATION.intercept + MATCH_CALIBRATION.slope × (rawScore − 50))
match = round(probability × 100)
```

Fitted September 21, 2026 on 1,563 held-out ratings: intercept −0.1747, slope 0.1869, Brier 0.2125 (vs. 0.25 for a constant guess). A raw 50 shows as 46%, a raw 70 as 90%, a raw 35 as 11%.

### Diversity — the dashboard picks (`diversity.ts`, `DIVERSITY`)

Short recommendation rows (dashboard picks) run their ranked candidates through `diversify`: maximal marginal relevance picks each slot as the candidate with the best `score − λ × similarityToClosestPickSoFar`, so a row of five is not five entries from one franchise or one director. One slot (`adventurousSlots`) is reserved for the best candidate outside the viewer's `usualGenreCount` most-rated genres, provided it clears `adventurousFloor` (55 calibrated Match); if none does, the slot stays dependable.

### Holdout (`recommendationEvaluation.ts`, `RECOMMENDATION_EVALUATION`)

`npm run recommendations:evaluate -- --all`, run September 21, 2026. A five-fold, per-medium, retrospective diagnostic: a held-out title is "liked" when rated `likedMargin` (1) above the viewer's own mean rating in that medium, "disliked" when `dislikedMargin` (1) below it; the reported accuracy is the fraction of liked/disliked pairs each ranker orders correctly (0.5 = chance).

Pooled pair accuracy: **v2 86.1%**, v1 ~72%, critics-alone ~87%, on the two biggest movie histories.

| Cell | Pairs | V2 | V1 | Critics alone |
|---|---:|---:|---:|---:|
| User A, movies | 2,742 | 82.3% | 68.0% | 82.8% |
| Main user, movies | 1,863 | 91.4% | 76.1% | 92.5% |
| Third user, movies | 75 | 86.7% | 60.0% | 75.3% |

Critics alone edge out v2 on the two largest histories, where personal taste and critical consensus mostly agree; v2's margin over v1 is largest where a user's taste diverges most from critics (the third user's cell).

Stored ratings of 0 are read as no rating by the engine (`explicitRating`, `minExplicitRating: 0.5`) — of the 164 zero-valued rows found, 163 belong to the main account's unplayed games and are placeholders, not real opinions. The database rows themselves still need a manual cleanup (set `personalRating` to `NULL` where it is 0, then `npm run ratings:recompute`), because a stored 0 still counts as a vote in community averages even though the engine ignores it.

---

## Previous engine (v1, kept for comparison) — `medialyMatch.ts`, `affinityProfile.ts`

Superseded by v2 above. Kept for the side-by-side admin comparison (`/data-health/recommendations`) and as the holdout baseline; reachable through `getRecommendationsV1`. Not used by any product page.

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

For each candidate, gather all followers who rated/completed it. Per follower, their **opinion** is a 0–100 value (`followerOpinion`):

```
opinion = rating != null ? clamp((rating − 5) × 20, 0, 100)
        : COMPLETED ? FRIEND_SIGNAL.completedInterest (15)
        : WATCHLIST ? FRIEND_SIGNAL.watchlistInterest (8)
        : 0
```

A 10/10 reaches 100; a 5 or below is no endorsement. Finishing or watchlisting without a rating is weak interest and is never stacked on top of a rating.

Each follower's **weight** (`followerWeight`) is their compatibility with the viewer, shrunk toward neutral by how many titles you've both rated so one matching rating can't make someone a taste twin:

```
reliability = overlap / (overlap + FRIEND_SIGNAL.overlapPrior)
weight = (50 + (compatibility − 50) × reliability) / 100
```

Then:

```
friendAffinity = (Σ opinion × weight / Σ weight) × (Σ weight / (Σ weight + FRIEND_SIGNAL.evidencePrior))
```

The second factor is why a single half-trusted friend moves the signal about half as far as a fully trusted one. Before this, with one contributing friend the weight cancelled out of the average entirely, and the per-follower value topped out at 48 while being weighted as a 0–100 input.

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

## Top 10 & cross-surface rankings (`lib/db/dashboard.ts`, `lib/insights.ts`, `lib/discover.ts`)

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

### Discover (`lib/discover.ts`, tunables in `config.ts:DISCOVER`)

Discover ranks on the same `dashboardQualityScore` as the Overall Top 10 and Canon, so its lists are **global**: identical for every viewer. The viewer only affects two things — titles they have COMPLETED, DROPPED or marked NOT_INTERESTED are hidden, and their own highly rated titles seed "If You Liked". Titles with neither a community rating nor a consensus score are not shown at all.

**Reach** = Medialy raters + external rating sources for the title (both from the cached ranking aggregates), expressed as a percentile within the genre pool.

The four sections are pairwise disjoint and chosen in this order:

| Section | Rule |
|---|---|
| Gateway (Start here) | Quality ≥ pool mean, `consensusConfidence ≥ 0.5`, reach percentile ≥ 0.5, and mainstream (at least half its subgenre tags are among the genre's 8 most common). Ranked by `quality × (0.5 + 0.5 × reachPercentile)`. Relaxes to the quality rule alone if fewer than 4 qualify. |
| Essentials | Top Quality among the rest with reach percentile ≥ 0.4 (the acknowledged best). Fills from lower reach only if the pool is too small. |
| Hidden Gems | Of what's left: Quality ≥ pool median and reach percentile ≤ 0.6, ranked by min-max Quality × (1 − reach percentile). |
| If You Liked | Seeds = the viewer's titles in the world scored at or above their own mean (top 4), else the Essentials. Partner = most similar unshown title by `0.7 × taxonomySimilarity + 0.3 × shared non-actor credits`, floor 0.25, each partner used once. |

Worlds (the marquee cards) are ordered by mean Quality shrunk toward the pool mean by `DISCOVER.worldRankPrior` pseudo-titles, then size, so a four-title world needs a big margin to outrank Drama. Poster captions show the Quality score, not the viewer's own rating.

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
| Tune v2 signal weights, priors, similarity | `config.ts:RECOMMENDATION_V2` |
| Tune Match calibration (what the % means) | `config.ts:MATCH_CALIBRATION`, `calibration.ts` |
| Tune dashboard pick variety | `config.ts:DIVERSITY`, `diversity.ts` |
| Tune the holdout's liked/disliked margins | `config.ts:RECOMMENDATION_EVALUATION` |
| Tune v1 Medialy Match weights | `config.ts:MEDIALY_MATCH_WEIGHTS` |
| Tune v1 affinity shrinkage / saturation | `config.ts:AFFINITY_TUNING` |
| Tune Top 10 / Insights shrinkage | `config.ts:TOP_RANKING` |
| Tune Discover section rules | `config.ts:DISCOVER` |
| Tune friend-signal trust | `config.ts:FRIEND_SIGNAL` |
| Tune Elo K-factor or confidence | `config.ts:PAIRWISE` |
| Tune source trust / applicability | `config.ts:SOURCE_TRUST_WEIGHTS`, `SOURCE_MEDIA_APPLICABILITY` |
| Add a new affinity bucket | `recommendations.ts:getAffinityMaps` + corresponding signal in `medialyMatch.ts` + weight in `config.ts` |
| Change role multipliers (director vs publisher) | `recommendations.ts:ROLE_WEIGHT` |
| Add a country to the exclusion list | `recommendations.ts:COUNTRY_AFFINITY_EXCLUSIONS` |
