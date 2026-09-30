import type {
  ContributorKind,
  CreditRole,
  MediaType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { normalizeSearchText } from "@/lib/text-normalization";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export type CreditInput = {
  role: CreditRole;
  kind: ContributorKind;
  names: string[];
  source?: string;
  /**
   * The provider's id for each name, aligned with `names` (TMDB person ids).
   * Recorded on the credit so people who share a name can be told apart later.
   */
  sourceIds?: Array<string | null>;
};

export type CreditDTO = {
  role: CreditRole;
  kind: ContributorKind;
  name: string;
  order: number;
};

export const CREDIT_ROLES_BY_MEDIA_TYPE: Record<MediaType, CreditRole[]> = {
  MOVIE: ["DIRECTOR", "ACTOR"],
  TV_SHOW: ["CREATOR", "ACTOR"],
  VIDEO_GAME: ["DEVELOPER", "PUBLISHER"],
  BOOK: [],
  BOARD_GAME: [],
  MUSIC: [],
  MUSICAL: ["ACTOR"],
};

export function normalizeContributorName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function contributorKey(value: string) {
  return normalizeSearchText(normalizeContributorName(value));
}

export function splitCreditNames(value: FormDataEntryValue | string | null) {
  return String(value ?? "")
    .split(/[;,]/)
    .map(normalizeContributorName)
    .filter(Boolean);
}

export function creditLabel(mediaType: MediaType, role: CreditRole) {
  if (mediaType === "MOVIE" && role === "DIRECTOR") return "Directed by";
  if (mediaType === "TV_SHOW" && role === "CREATOR") return "Created by";
  if (mediaType === "VIDEO_GAME" && role === "DEVELOPER")
    return "Developed by";
  if (mediaType === "VIDEO_GAME" && role === "PUBLISHER")
    return "Published by";
  if (role === "ACTOR") return "Starring";
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** The role as a noun for a person ("Director", "Actor"). */
export function creditRoleNoun(role: CreditRole): string {
  switch (role) {
    case "DIRECTOR":
      return "Director";
    case "CREATOR":
      return "Creator";
    case "DEVELOPER":
      return "Developer";
    case "PUBLISHER":
      return "Publisher";
    case "ACTOR":
      return "Actor";
    default:
      return creditLabel("MOVIE", role);
  }
}

export function creditFieldName(role: CreditRole) {
  if (role === "DIRECTOR") return "directorCredits";
  if (role === "CREATOR") return "creatorCredits";
  if (role === "DEVELOPER") return "developerCredits";
  if (role === "PUBLISHER") return "publisherCredits";
  if (role === "ACTOR") return "actorCredits";
  return "credits";
}

export function creditKindForRole(role: CreditRole): ContributorKind {
  return role === "DEVELOPER" || role === "PUBLISHER" ? "COMPANY" : "PERSON";
}

export async function replaceMediaCredits(
  client: PrismaLike,
  mediaId: string,
  credits: CreditInput[],
) {
  const roles = credits.map((credit) => credit.role);
  // Credits are replaced wholesale, but a provider id recorded earlier must
  // survive an edit that only resubmits names (the edit form, an approved
  // suggestion). Remember what each (role, person) carried before the delete.
  const previous = new Map(
    (
      await client.mediaCredit.findMany({
        where: { mediaId, role: { in: roles } },
        select: { contributorId: true, role: true, source: true, sourceId: true },
      })
    ).map((row) => [`${row.role}:${row.contributorId}`, row]),
  );
  await client.mediaCredit.deleteMany({
    where: { mediaId, role: { in: roles } },
  });

  for (const credit of credits) {
    // Keyed by name, not position: de-duplicating names below shifts indexes.
    const idsByName = new Map<string, string>();
    credit.names.forEach((name, index) => {
      const id = credit.sourceIds?.[index];
      const key = contributorKey(normalizeContributorName(name));
      if (id && key && !idsByName.has(key)) idsByName.set(key, id);
    });
    const uniqueNames = [
      ...new Map(
        credit.names
          .map(normalizeContributorName)
          .filter(Boolean)
          .map((name) => [contributorKey(name), name]),
      ).values(),
    ];

    for (const [index, name] of uniqueNames.entries()) {
      const contributor = await client.contributor.upsert({
        where: {
          normalizedName_kind: {
            normalizedName: contributorKey(name),
            kind: credit.kind,
          },
        },
        update: { name },
        create: {
          name,
          normalizedName: contributorKey(name),
          kind: credit.kind,
        },
      });

      const before = previous.get(`${credit.role}:${contributor.id}`);
      const sourceId = idsByName.get(contributorKey(name));
      await client.mediaCredit.create({
        data: {
          mediaId,
          contributorId: contributor.id,
          role: credit.role,
          order: index,
          source: sourceId ? credit.source : (credit.source ?? before?.source),
          sourceId: sourceId ?? before?.sourceId ?? null,
        },
      });
    }
  }
}

export function creditsForRole(credits: CreditDTO[], role: CreditRole) {
  return credits
    .filter((credit) => credit.role === role)
    .sort((first, second) => first.order - second.order)
    .map((credit) => credit.name);
}
