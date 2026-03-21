import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('billing')
    .addColumn('user_id', 'uuid', (col) => col.references('users(id)'))
    .execute();

  await db.schema
    .createIndex('billing_user_id_index')
    .on('billing')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('billing_user_id_index').execute();
  await db.schema
    .alterTable('billing')
    .dropColumn('user_id')
    .execute();
}
