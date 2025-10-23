import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Check if columns exist before adding them
  const { rows } = await sql<{ column_name: string }>`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name IN ('suspended_at', 'suspension_reason')
  `.execute(db);

  const existingColumns = new Set(rows.map(r => r.column_name));

  if (!existingColumns.has('suspended_at')) {
    await db.schema
      .alterTable('users')
      .addColumn('suspended_at', 'timestamptz', (col) => col)
      .execute();
  }

  if (!existingColumns.has('suspension_reason')) {
    await db.schema
      .alterTable('users')
      .addColumn('suspension_reason', 'text', (col) => col)
      .execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('suspended_at')
    .dropColumn('suspension_reason')
    .execute();
}

