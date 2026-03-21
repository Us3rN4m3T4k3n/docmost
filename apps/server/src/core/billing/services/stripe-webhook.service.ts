import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../../database/types/kysely.types';
import Stripe from 'stripe';
import { UserProvisioningService } from './user-provisioning.service';
import { BillingService } from './billing.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { StripeEventType } from '../billing.constants';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private readonly stripe: Stripe;

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly userProvisioningService: UserProvisioningService,
    private readonly billingService: BillingService,
    private readonly environmentService: EnvironmentService,
  ) {
    this.stripe = new Stripe(this.environmentService.getStripeSecretKey());
  }

  verifyAndParse(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.environmentService.getStripeWebhookSecret(),
    );
  }

  async handle(event: Stripe.Event): Promise<void> {
    // Idempotency check
    const existing = await this.db
      .selectFrom('stripeWebhookEvents')
      .select('eventId')
      .where('eventId', '=', event.id)
      .executeTakeFirst();

    if (existing) {
      this.logger.log(`Skipping duplicate Stripe event: ${event.id}`);
      return;
    }

    // Insert dedup record before processing
    await this.db
      .insertInto('stripeWebhookEvents')
      .values({ eventId: event.id, eventType: event.type })
      .execute();

    const workspaceId = await this.getWorkspaceId();

    try {
      switch (event.type) {
        case StripeEventType.CHECKOUT_COMPLETED: {
          const session = event.data.object as Stripe.Checkout.Session;
          const email = session.customer_email ?? '';
          const customerId =
            typeof session.customer === 'string' ? session.customer : '';
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : '';
          const name = email.split('@')[0];
          const spaceId = this.environmentService.getClientSpaceId();

          await this.userProvisioningService.provision({
            email,
            name,
            spaceId,
            workspaceId,
            gateway: 'stripe',
            gatewayCustomerId: customerId,
            gatewaySubscriptionId: subscriptionId,
          });
          break;
        }

        case StripeEventType.SUBSCRIPTION_DELETED: {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : '';
          const billing =
            await this.billingService.findBillingByCustomerId(customerId);
          if (!billing) {
            this.logger.warn(`No billing record for customer: ${customerId}`);
            break;
          }
          await this.userProvisioningService.revoke(billing.email, workspaceId);
          break;
        }

        case StripeEventType.INVOICE_PAYMENT_FAILED: {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId =
            typeof invoice.customer === 'string' ? invoice.customer : '';
          const billing =
            await this.billingService.findBillingByCustomerId(customerId);
          if (!billing) {
            this.logger.warn(`No billing record for customer: ${customerId}`);
            break;
          }
          await this.userProvisioningService.lock(billing.email, workspaceId);
          break;
        }

        case StripeEventType.INVOICE_PAYMENT_SUCCEEDED: {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId =
            typeof invoice.customer === 'string' ? invoice.customer : '';
          const billing =
            await this.billingService.findBillingByCustomerId(customerId);
          if (!billing) {
            this.logger.warn(`No billing record for customer: ${customerId}`);
            break;
          }
          const spaceId = this.environmentService.getClientSpaceId();
          await this.userProvisioningService.unlock(
            billing.email,
            workspaceId,
            spaceId,
          );
          break;
        }

        default:
          this.logger.log(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error processing Stripe event ${event.id}: ${msg}`);
      throw err;
    }
  }

  private async getWorkspaceId(): Promise<string> {
    const workspace = await this.db
      .selectFrom('workspaces')
      .select('id')
      .limit(1)
      .executeTakeFirst();
    return workspace?.id ?? '';
  }
}
