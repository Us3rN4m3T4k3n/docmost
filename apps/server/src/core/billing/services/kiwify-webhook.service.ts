import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../../database/types/kysely.types';
import { UserProvisioningService } from './user-provisioning.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { KiwifyEventType } from '../billing.constants';

@Injectable()
export class KiwifyWebhookService {
  private readonly logger = new Logger(KiwifyWebhookService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly userProvisioningService: UserProvisioningService,
    private readonly environmentService: EnvironmentService,
  ) {}

  verify(payload: any): void {
    const expectedToken = this.environmentService.getKiwifyWebhookToken();
    if (expectedToken && payload?.token !== expectedToken) {
      throw new UnauthorizedException('Invalid Kiwify webhook token');
    }
  }

  async handle(payload: any): Promise<void> {
    const eventType: string =
      payload?.webhook_event_type ??
      payload?.order_status ??
      payload?.event_type ??
      '';

    const orderId: string =
      payload?.order_id ?? payload?.id ?? `kiwify-${Date.now()}`;

    // Idempotency check
    const existing = await this.db
      .selectFrom('kiwifyWebhookEvents')
      .select('orderId')
      .where('orderId', '=', orderId)
      .executeTakeFirst();

    if (existing) {
      this.logger.log(`Skipping duplicate Kiwify event: ${orderId}`);
      return;
    }

    // Insert dedup record
    await this.db
      .insertInto('kiwifyWebhookEvents')
      .values({ orderId, eventType })
      .execute();

    const email: string = payload?.Customer?.email ?? '';
    const name: string =
      payload?.Customer?.full_name ?? email.split('@')[0];
    const workspaceId = await this.getWorkspaceId();

    try {
      switch (eventType) {
        case KiwifyEventType.PURCHASE_APPROVED: {
          const spaceId = this.environmentService.getKiwifyClientSpaceId();
          const subscriptionId = payload?.Subscription?.id ?? '';

          await this.userProvisioningService.provision({
            email,
            name,
            spaceId,
            workspaceId,
            gateway: 'kiwify',
            gatewaySubscriptionId: subscriptionId,
          });
          break;
        }

        case KiwifyEventType.SUBSCRIPTION_CANCELED: {
          await this.userProvisioningService.revoke(email, workspaceId);
          break;
        }

        case KiwifyEventType.SUBSCRIPTION_LATE: {
          await this.userProvisioningService.lock(email, workspaceId);
          break;
        }

        case KiwifyEventType.SUBSCRIPTION_RENEWED: {
          const spaceId = this.environmentService.getKiwifyClientSpaceId();
          await this.userProvisioningService.unlock(email, workspaceId, spaceId);
          break;
        }

        default:
          this.logger.log(`Unhandled Kiwify event type: ${eventType}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error processing Kiwify event ${orderId}: ${msg}`);
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
