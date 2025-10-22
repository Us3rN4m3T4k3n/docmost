import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('suspended_at', 'timestamptz', (col) => col)
    .addColumn('suspension_reason', 'text', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('suspended_at')
    .dropColumn('suspension_reason')
    .execute();
}

