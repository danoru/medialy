import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Dev-only egress instrumentation. Set `PRISMA_QUERY_LOG=1` to log, per query,
 * the model/operation and the serialized size of the returned rows — a close
 * proxy for how many bytes Neon actually sent us. Used to compare query cost
 * before/after the catalog projection work; off by default so production never
 * pays the `JSON.stringify` cost.
 */
const QUERY_LOG_ENABLED =
  process.env.PRISMA_QUERY_LOG === "1" && process.env.NODE_ENV !== "production";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function createPrismaClient() {
  const client = new PrismaClient();
  if (!QUERY_LOG_ENABLED) return client;

  return client.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const started = Date.now();
        const result = await query(args);
        const elapsed = Date.now() - started;
        const bytes = JSON.stringify(result ?? null).length;
        const rows = Array.isArray(result) ? result.length : 1;
        console.log(
          `[egress] ${model ?? "raw"}.${operation} rows=${rows} bytes=${formatBytes(bytes)} (${bytes}) ${elapsed}ms`,
        );
        return result;
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
