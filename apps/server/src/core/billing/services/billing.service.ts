import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../../database/types/kysely.types';

export interface BillingWithUser {
  id: string;
  userId: string | null;
  workspaceId: string;
  gateway: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  kiwifySubscriptionId: string | null;
  kiwifyCustomerEmail: string | null;
  email: string;
}

export interface SubscriberRow {
  id: string;
  email: string;
  name: string | null;
  billingLockedAt: Date | null;
  stripeCustomerId: string | null;
  gateway: string;
  status: string;
  stripeSubscriptionId: string;
  kiwifySubscriptionId: string | null;
}

export interface CreateOrUpdateBillingParams {
  userId: string;
  workspaceId: string;
  gateway: 'stripe' | 'kiwify';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  kiwifySubscriptionId?: string;
  kiwifyCustomerEmail?: string;
  status?: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async createOrUpdateBillingRecord(
    params: CreateOrUpdateBillingParams,
  ): Promise<void> {
    const {
      userId,
      workspaceId,
      gateway,
      stripeCustomerId,
      stripeSubscriptionId,
      kiwifySubscriptionId,
      kiwifyCustomerEmail,
      status = 'active',
    } = params;

    // Determine the subscription identifier to look up
    const subscriptionId =
      gateway === 'stripe' ? stripeSubscriptionId : kiwifySubscriptionId;

    if (!subscriptionId) {
      // No subscription ID — insert a new record
      await this.db
        .insertInto('billing')
        .values({
          userId,
          workspaceId,
          gateway,
          stripeCustomerId: stripeCustomerId ?? null,
          stripeSubscriptionId: stripeSubscriptionId ?? '',
          kiwifySubscriptionId: kiwifySubscriptionId ?? null,
          kiwifyCustomerEmail: kiwifyCustomerEmail ?? null,
          status,
          periodStartAt: new Date(),
        })
        .execute();
      return;
    }

    // Check if record exists by subscription ID
    let existing = null;
    if (gateway === 'stripe' && stripeSubscriptionId) {
      existing = await this.db
        .selectFrom('billing')
        .select('id')
        .where('stripeSubscriptionId', '=', stripeSubscriptionId)
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst();
    } else if (gateway === 'kiwify' && kiwifySubscriptionId) {
      existing = await this.db
        .selectFrom('billing')
        .select('id')
        .where('kiwifySubscriptionId', '=', kiwifySubscriptionId)
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst();
    }

    if (existing) {
      await this.db
        .updateTable('billing')
        .set({
          status,
          userId,
          stripeCustomerId: stripeCustomerId ?? null,
          kiwifySubscriptionId: kiwifySubscriptionId ?? null,
          kiwifyCustomerEmail: kiwifyCustomerEmail ?? null,
          updatedAt: new Date(),
        })
        .where('id', '=', existing.id)
        .execute();
    } else {
      await this.db
        .insertInto('billing')
        .values({
          userId,
          workspaceId,
          gateway,
          stripeCustomerId: stripeCustomerId ?? null,
          stripeSubscriptionId: stripeSubscriptionId ?? '',
          kiwifySubscriptionId: kiwifySubscriptionId ?? null,
          kiwifyCustomerEmail: kiwifyCustomerEmail ?? null,
          status,
          periodStartAt: new Date(),
        })
        .execute();
    }
  }

  async getSubscribers(workspaceId: string): Promise<SubscriberRow[]> {
    const rows = await this.db
      .selectFrom('billing')
      .innerJoin('users', 'billing.userId', 'users.id')
      .select([
        'users.id',
        'users.email',
        'users.name',
        'users.billingLockedAt',
        'billing.stripeCustomerId',
        'billing.gateway',
        'billing.status',
        'billing.stripeSubscriptionId',
        'billing.kiwifySubscriptionId',
      ])
      .where('billing.workspaceId', '=', workspaceId)
      .execute();

    return rows as SubscriberRow[];
  }

  async findBillingByCustomerId(
    stripeCustomerId: string,
  ): Promise<BillingWithUser | null> {
    const row = await this.db
      .selectFrom('billing')
      .innerJoin('users', 'billing.userId', 'users.id')
      .select([
        'billing.id',
        'billing.userId',
        'billing.workspaceId',
        'billing.gateway',
        'billing.status',
        'billing.stripeCustomerId',
        'billing.stripeSubscriptionId',
        'billing.kiwifySubscriptionId',
        'billing.kiwifyCustomerEmail',
        'users.email',
      ])
      .where('billing.stripeCustomerId', '=', stripeCustomerId)
      .executeTakeFirst();

    return (row as BillingWithUser) ?? null;
  }

  async findBillingByEmail(
    email: string,
    workspaceId: string,
  ): Promise<BillingWithUser | null> {
    const row = await this.db
      .selectFrom('billing')
      .innerJoin('users', 'billing.userId', 'users.id')
      .select([
        'billing.id',
        'billing.userId',
        'billing.workspaceId',
        'billing.gateway',
        'billing.status',
        'billing.stripeCustomerId',
        'billing.stripeSubscriptionId',
        'billing.kiwifySubscriptionId',
        'billing.kiwifyCustomerEmail',
        'users.email',
      ])
      .where('users.email', '=', email.toLowerCase().trim())
      .where('billing.workspaceId', '=', workspaceId)
      .executeTakeFirst();

    return (row as BillingWithUser) ?? null;
  }

  async findBillingByUserId(userId: string): Promise<BillingWithUser | null> {
    const row = await this.db
      .selectFrom('billing')
      .innerJoin('users', 'billing.userId', 'users.id')
      .select([
        'billing.id',
        'billing.userId',
        'billing.workspaceId',
        'billing.gateway',
        'billing.status',
        'billing.stripeCustomerId',
        'billing.stripeSubscriptionId',
        'billing.kiwifySubscriptionId',
        'billing.kiwifyCustomerEmail',
        'users.email',
      ])
      .where('billing.userId', '=', userId)
      .limit(1)
      .executeTakeFirst();

    return (row as BillingWithUser) ?? null;
  }
}
