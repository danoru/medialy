export const PERSONAL_SCORE_RELATIONAL_WEIGHT = 0.3;

export const SOURCE_TRUST_WEIGHTS = {
  METACRITIC: 1,
} as const;

export const MEDIALY_MATCH_WEIGHTS = {
  personalScore: 0.22,
  genreAffinity: 0.22,
  tagAffinity: 0.12,
  friendAffinity: 0.18,
  status: 0.18,
  upcoming: 0.04,
  consensus: 0.08,
} as const;
