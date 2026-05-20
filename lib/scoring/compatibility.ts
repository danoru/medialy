import { FRIEND_COMPATIBILITY } from "@/lib/scoring/config";

export function calculateFriendCompatibility(
  pairs: Array<{ userRating: number; friendRating: number }>,
) {
  if (pairs.length === 0) {
    return {
      overlapCount: 0,
      compatibilityScore: 0,
      averageDistance: null,
    };
  }

  const distance = pairs.reduce(
    (sum, pair) => sum + Math.abs(pair.userRating - pair.friendRating),
    0,
  );
  const averageDistance = distance / pairs.length;

  return {
    overlapCount: pairs.length,
    compatibilityScore: Math.max(
      0,
      Math.round(
        100 - averageDistance * FRIEND_COMPATIBILITY.ratingDistancePenalty,
      ),
    ),
    averageDistance,
  };
}
