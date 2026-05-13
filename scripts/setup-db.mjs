import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const prisma = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

if (!existsSync(prisma)) {
  console.error(
    "Prisma CLI not found. Run npm install before npm run db:setup.",
  );
  process.exit(1);
}

const run = (args) => {
  const result = spawnSync(prisma, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run(["generate"]);
run(["migrate", "dev", "--name", "init", "--skip-seed"]);
run(["db", "seed"]);
