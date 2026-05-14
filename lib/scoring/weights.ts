export const PERSONAL_SCORE_RELATIONAL_WEIGHT = 0.3;

export const SOURCE_TRUST_WEIGHTS = {
  METACRITIC: 1,
} as const;

export const MEDIALY_MATCH_WEIGHTS = {
  personalScore: 0.38,
  genreAffinity: 0.2,
  tagAffinity: 0.1,
  friendAffinity: 0.14,
  status: 0.1,
  upcoming: 0.04,
  consensus: 0.04,
} as const;
