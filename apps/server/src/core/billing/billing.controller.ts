import {
  Controller,
  Post,
  Get,
  Req,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../database/types/kysely.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User } from '@docmost/db/types/entity.types';
import { Workspace } from '@docmost/db/types/entity.types';
import { BillingService } from './services/billing.service';
import { UserProvisioningService } from './services/user-provisioning.service';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { KiwifyWebhookService } from './services/kiwify-webhook.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly environmentService: EnvironmentService,
    private readonly userProvisioningService: UserProvisioningService,
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly kiwifyWebhookService: KiwifyWebhookService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') sig: string,
  ) {
    let event: Stripe.Event;
    try {
      event = this.stripeWebhookService.verifyAndParse(req.rawBody, sig);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Webhook signature failed: ${msg}`);
    }
    await this.stripeWebhookService.handle(event);
    return { received: true };
  }

  @Post('kiwify/webhook')
  @HttpCode(HttpStatus.OK)
  async kiwifyWebhook(@Body() body: any) {
    this.kiwifyWebhookService.verify(body);
    await this.kiwifyWebhookService.handle(body);
    return { received: true };
  }

  @Get('portal')
  @UseGuards(JwtAuthGuard)
  async createPortalSession(@AuthUser() user: User) {
    const billing = await this.billingService.findBillingByUserId(user.id);

    if (!billing || !billing.stripeCustomerId) {
      throw new NotFoundException('No active subscription found');
    }

    if (billing.gateway !== 'stripe') {
      throw new BadRequestException(
        'Portal not available for this subscription type',
      );
    }

    const stripe = new Stripe(this.environmentService.getStripeSecretKey());

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${this.environmentService.getAppUrl()}/settings/account/profile`,
    });

    return { url: session.url };
  }

  @Get('admin/subscribers')
  @UseGuards(JwtAuthGuard)
  async getSubscribers(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (user.role !== 'admin' && user.role !== 'owner') {
      throw new ForbiddenException();
    }

    const rows = await this.billingService.getSubscribers(workspace.id);

    return rows.map((row) => {
      let status: 'active' | 'locked' | 'cancelled';
      if (row.billingLockedAt) {
        status = row.status === 'canceled' ? 'cancelled' : 'locked';
      } else {
        status = 'active';
      }

      return {
        id: row.id,
        email: row.email,
        name: row.name,
        gateway: row.gateway,
        status,
        stripeCustomerId: row.stripeCustomerId,
      };
    });
  }

  @Post('admin/revoke')
  @UseGuards(JwtAuthGuard)
  async revokeAccess(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() body: { userId: string },
  ) {
    if (user.role !== 'admin' && user.role !== 'owner') {
      throw new ForbiddenException();
    }

    const targetUser = await this.db
      .selectFrom('users')
      .select(['email'])
      .where('id', '=', body.userId)
      .executeTakeFirst();

    if (!targetUser) {
      throw new NotFoundException();
    }

    await this.userProvisioningService.revoke(targetUser.email, workspace.id);
    return { success: true };
  }

  @Post('admin/restore')
  @UseGuards(JwtAuthGuard)
  async restoreAccess(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() body: { userId: string },
  ) {
    if (user.role !== 'admin' && user.role !== 'owner') {
      throw new ForbiddenException();
    }

    const targetUser = await this.db
      .selectFrom('users')
      .select(['email'])
      .where('id', '=', body.userId)
      .executeTakeFirst();

    if (!targetUser) {
      throw new NotFoundException();
    }

    const billing = await this.billingService.findBillingByUserId(body.userId);
    if (!billing) {
      throw new NotFoundException('No billing record found');
    }

    const spaceId =
      billing.gateway === 'kiwify'
        ? this.environmentService.getKiwifyClientSpaceId()
        : this.environmentService.getClientSpaceId();

    await this.userProvisioningService.unlock(
      targetUser.email,
      workspace.id,
      spaceId,
    );
    return { success: true };
  }
}
