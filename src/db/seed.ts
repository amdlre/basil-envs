import { sql } from 'drizzle-orm';

import { environmentTypes } from './schema';
import { ENVIRONMENT_TYPES_SEED } from './seed-data';

import { closeDb, getDb } from './index';

/**
 * Idempotent: upserts the catalog by slug. Re-running restores seeded names,
 * descriptions, colors and flags but never deletes custom types added via Settings.
 */
async function seed() {
  const db = getDb();

  const rows = await db
    .insert(environmentTypes)
    .values([...ENVIRONMENT_TYPES_SEED])
    .onConflictDoUpdate({
      target: environmentTypes.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameAr: sql`excluded.name_ar`,
        descriptionEn: sql`excluded.description_en`,
        descriptionAr: sql`excluded.description_ar`,
        color: sql`excluded.color`,
        sortOrder: sql`excluded.sort_order`,
        isDefault: sql`excluded.is_default`,
        isProtected: sql`excluded.is_protected`,
      },
    })
    .returning({ slug: environmentTypes.slug });

  console.info(`✓ Seeded ${rows.length} environment types`);
}

seed()
  .catch((error: unknown) => {
    console.error('✗ Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
