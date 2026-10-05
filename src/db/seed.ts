import { environmentTypes } from './schema';
import { ENVIRONMENT_TYPES_SEED } from './seed-data';

import { closeDb, getDb } from './index';

/**
 * Idempotent and non-destructive: inserts catalog types that don't exist yet (by slug)
 * and never overwrites existing rows, so edits made in Settings → Environment Catalog
 * (names, colors, order, flags) survive re-seeding and container restarts.
 */
async function seed() {
  const rows = await getDb()
    .insert(environmentTypes)
    .values([...ENVIRONMENT_TYPES_SEED])
    .onConflictDoNothing({ target: environmentTypes.slug })
    .returning({ slug: environmentTypes.slug });

  console.info(
    rows.length > 0
      ? `✓ Seeded ${rows.length} environment types`
      : '✓ Environment catalog already seeded',
  );
}

seed()
  .catch((error: unknown) => {
    console.error('✗ Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
