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
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { BillingService } from './services/billing.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') sig: string,
  ) {
    return { received: true };
  }

  @Post('kiwify/webhook')
  @HttpCode(HttpStatus.OK)
  async kiwifyWebhook(@Body() body: any) {
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
}
