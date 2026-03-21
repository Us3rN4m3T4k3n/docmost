import {
  Controller,
  Post,
  Req,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

@Controller('billing')
export class BillingController {
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
}
