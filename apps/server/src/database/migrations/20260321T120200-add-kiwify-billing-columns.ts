import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('billing')
    .addColumn('gateway', 'varchar', (col) => col.notNull().defaultTo(sql`'stripe'`))
    .addColumn('kiwify_subscription_id', 'varchar')
    .addColumn('kiwify_customer_email', 'varchar')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('billing')
    .dropColumn('gateway')
    .dropColumn('kiwify_subscription_id')
    .dropColumn('kiwify_customer_email')
    .execute();
}
