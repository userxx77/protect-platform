import { Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

/**
 * Stripe webhook placeholder — verify `Stripe-Signature` before trusting (see Stripe docs).
 * Map subscription / customer to guild entitlement in a future iteration.
 */
@ApiTags('webhooks')
@Controller()
export class StripeWebhookController {
  @Post('webhooks/stripe')
  async stripe(
    @Req() req: Request,
    @Headers('stripe-signature') _sig: string | undefined,
  ): Promise<{ received: boolean }> {
    void req;
    void _sig;
    return { received: true };
  }
}
