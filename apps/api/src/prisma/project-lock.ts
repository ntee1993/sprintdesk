import type { Prisma } from '../generated/prisma/client.js';

// Task writes and membership removal/role changes acquire this row before other rows.
// READ COMMITTED ensures checks following a waited-for lock see the latest commit.
export async function lockProject(
  tx: Prisma.TransactionClient,
  projectId: number,
) {
  await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
}
