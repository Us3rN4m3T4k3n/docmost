import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './services/billing.service';
import { UserProvisioningService } from './services/user-provisioning.service';
import { EnvironmentModule } from '../../integrations/environment/environment.module';

@Module({
  imports: [EnvironmentModule],
  controllers: [BillingController],
  providers: [BillingService, UserProvisioningService],
  exports: [BillingService, UserProvisioningService],
})
export class BillingModule {}
