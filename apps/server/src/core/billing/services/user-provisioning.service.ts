import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../../database/types/kysely.types';
import { MailService } from '../../../integrations/mail/mail.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { nanoIdGen } from '../../../common/helpers';
import WelcomeEmail from '../../../integrations/transactional/emails/welcome-email';
import { BillingService, CreateOrUpdateBillingParams } from './billing.service';
import { randomUUID } from 'crypto';

export interface ProvisionInput {
  email: string;
  name: string;
  spaceId: string;
  workspaceId: string;
  gateway: 'stripe' | 'kiwify';
  gatewayCustomerId?: string;
  gatewaySubscriptionId?: string;
}

@Injectable()
export class UserProvisioningService {
  private readonly logger = new Logger(UserProvisioningService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly mailService: MailService,
    private readonly environmentService: EnvironmentService,
    private readonly billingService: BillingService,
  ) {}

  async provision(input: ProvisionInput): Promise<{ id: string; email: string }> {
    const email = input.email.toLowerCase().trim();
    const appUrl = this.environmentService.getAppUrl();

    return await this.db.transaction().execute(async (trx) => {
      // Check if user already exists in this workspace
      const existingUser = await trx
        .selectFrom('users')
        .select(['id', 'billingLockedAt'])
        .where('email', '=', email)
        .where('workspaceId', '=', input.workspaceId)
        .executeTakeFirst();

      let userId: string;

      if (existingUser) {
        // Re-activation path
        userId = existingUser.id;

        // Clear billing lock
        await trx
          .updateTable('users')
          .set({ billingLockedAt: null, updatedAt: new Date() })
          .where('id', '=', userId)
          .execute();

        // Check space membership — add if missing
        const spaceMember = await trx
          .selectFrom('spaceMembers')
          .select('id')
          .where('userId', '=', userId)
          .where('spaceId', '=', input.spaceId)
          .where('deletedAt', 'is', null)
          .executeTakeFirst();

        if (!spaceMember) {
          await trx
            .insertInto('spaceMembers')
            .values({
              userId,
              spaceId: input.spaceId,
              role: 'reader',
            })
            .execute();
        }
      } else {
        // New account path — direct Kysely insert, NOT userRepo.insertUser()
        // to avoid the unconditional hashPassword(null) call
        userId = randomUUID();
        const locale = input.gateway === 'kiwify' ? 'pt-BR' : 'en-US';

        await trx
          .insertInto('users')
          .values({
            id: userId as any,
            email,
            name: input.name,
            password: null,
            workspaceId: input.workspaceId,
            role: 'member',
            locale,
          })
          .execute();

        // Add to space as READER
        await trx
          .insertInto('spaceMembers')
          .values({
            userId,
            spaceId: input.spaceId,
            role: 'reader',
          })
          .execute();
      }

      // Create or update billing record (outside transaction — billing service uses its own db)
      const billingParams: CreateOrUpdateBillingParams = {
        userId,
        workspaceId: input.workspaceId,
        gateway: input.gateway,
        status: 'active',
      };

      if (input.gateway === 'stripe') {
        billingParams.stripeCustomerId = input.gatewayCustomerId;
        billingParams.stripeSubscriptionId = input.gatewaySubscriptionId;
      } else {
        billingParams.kiwifySubscriptionId = input.gatewaySubscriptionId;
        billingParams.kiwifyCustomerEmail = email;
      }

      // Generate set-password token
      const token = nanoIdGen(16);
      await trx
        .insertInto('userTokens')
        .values({
          token,
          userId,
          workspaceId: input.workspaceId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          type: 'forgot-password',
        })
        .execute();

      const setPasswordLink = `${appUrl}/password-reset?token=${token}`;

      // Send welcome email (fire-and-forget — do not block provision)
      const emailTemplate = WelcomeEmail({
        username: input.name,
        setPasswordLink,
        appUrl,
      });

      this.mailService
        .sendToQueue({
          to: email,
          subject: 'Welcome — set your password to get started',
          template: emailTemplate,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to send welcome email to ${email}: ${err?.message}`,
          );
        });

      return { id: userId, email };
    }).then(async (user) => {
      // Create billing record after transaction commits
      const billingParams: CreateOrUpdateBillingParams = {
        userId: user.id,
        workspaceId: input.workspaceId,
        gateway: input.gateway,
        status: 'active',
      };

      if (input.gateway === 'stripe') {
        billingParams.stripeCustomerId = input.gatewayCustomerId;
        billingParams.stripeSubscriptionId = input.gatewaySubscriptionId;
      } else {
        billingParams.kiwifySubscriptionId = input.gatewaySubscriptionId;
        billingParams.kiwifyCustomerEmail = email;
      }

      await this.billingService.createOrUpdateBillingRecord(billingParams);
      return user;
    });
  }

  async revoke(email: string, workspaceId: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    await this.db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom('users')
        .select('id')
        .where('email', '=', normalizedEmail)
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst();

      if (!user) {
        // Idempotent — user not found, nothing to do
        return;
      }

      // Set billing lock
      await trx
        .updateTable('users')
        .set({ billingLockedAt: new Date(), updatedAt: new Date() })
        .where('id', '=', user.id)
        .execute();

      // Remove from all spaces in this workspace
      const spaceMemberships = await trx
        .selectFrom('spaceMembers')
        .innerJoin('spaces', 'spaceMembers.spaceId', 'spaces.id')
        .select('spaceMembers.id')
        .where('spaceMembers.userId', '=', user.id)
        .where('spaces.workspaceId', '=', workspaceId)
        .where('spaceMembers.deletedAt', 'is', null)
        .execute();

      for (const membership of spaceMemberships) {
        await trx
          .updateTable('spaceMembers')
          .set({ deletedAt: new Date() })
          .where('id', '=', membership.id)
          .execute();
      }
    });
  }

  async lock(email: string, workspaceId: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.db
      .selectFrom('users')
      .select('id')
      .where('email', '=', normalizedEmail)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!user) {
      return;
    }

    // Set billingLockedAt — do NOT remove from space (per spec: lock vs revoke)
    await this.db
      .updateTable('users')
      .set({ billingLockedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', user.id)
      .execute();
  }

  async unlock(
    email: string,
    workspaceId: string,
    spaceId: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.db
      .selectFrom('users')
      .select('id')
      .where('email', '=', normalizedEmail)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!user) {
      return;
    }

    // Clear billing lock
    await this.db
      .updateTable('users')
      .set({ billingLockedAt: null, updatedAt: new Date() })
      .where('id', '=', user.id)
      .execute();

    // Re-add to space if not already a member
    const spaceMember = await this.db
      .selectFrom('spaceMembers')
      .select('id')
      .where('userId', '=', user.id)
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!spaceMember) {
      await this.db
        .insertInto('spaceMembers')
        .values({
          userId: user.id,
          spaceId,
          role: 'reader',
        })
        .execute();
    }
  }
}
