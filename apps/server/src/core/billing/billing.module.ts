import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './services/billing.service';
import { UserProvisioningService } from './services/user-provisioning.service';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { KiwifyWebhookService } from './services/kiwify-webhook.service';
import { EnvironmentModule } from '../../integrations/environment/environment.module';

@Module({
  imports: [EnvironmentModule],
  controllers: [BillingController],
  providers: [BillingService, UserProvisioningService, StripeWebhookService, KiwifyWebhookService],
  exports: [BillingService, UserProvisioningService],
})
export class BillingModule {}
