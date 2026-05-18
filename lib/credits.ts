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
};

export type CreditDTO = {
  role: CreditRole;
  kind: ContributorKind;
  name: string;
  order: number;
};

export const CREDIT_ROLES_BY_MEDIA_TYPE: Record<MediaType, CreditRole[]> = {
  MOVIE: ["DIRECTOR"],
  TV_SHOW: ["CREATOR"],
  VIDEO_GAME: ["DEVELOPER", "PUBLISHER"],
  BOOK: [],
  BOARD_GAME: [],
  MUSIC: [],
  MUSICAL: [],
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
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function creditFieldName(role: CreditRole) {
  if (role === "DIRECTOR") return "directorCredits";
  if (role === "CREATOR") return "creatorCredits";
  if (role === "DEVELOPER") return "developerCredits";
  if (role === "PUBLISHER") return "publisherCredits";
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
  await client.mediaCredit.deleteMany({
    where: { mediaId, role: { in: roles } },
  });

  for (const credit of credits) {
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

      await client.mediaCredit.create({
        data: {
          mediaId,
          contributorId: contributor.id,
          role: credit.role,
          order: index,
          source: credit.source,
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
