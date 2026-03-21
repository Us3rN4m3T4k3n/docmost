import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('stripe_webhook_events')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('event_id', 'varchar', (col) => col.unique().notNull())
    .addColumn('event_type', 'varchar', (col) => col.notNull())
    .addColumn('processed_at', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await db.schema
    .createTable('kiwify_webhook_events')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('order_id', 'varchar', (col) => col.unique().notNull())
    .addColumn('event_type', 'varchar', (col) => col.notNull())
    .addColumn('processed_at', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('kiwify_webhook_events').execute();
  await db.schema.dropTable('stripe_webhook_events').execute();
}
