import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlagPolicyService } from './flag-policy.service';

/**
 * Production flag decay runs in `@protect/worker` (see `FLAG_DECAY_*` env vars).
 * This service is reserved for future hooks; domain writes do not depend on decay here.
 */
@Injectable()
export class FlagDecayService {
  constructor(
    private readonly policy: FlagPolicyService,
    private readonly config: ConfigService,
  ) {}

  async maybeApplyDecay(_userId: string): Promise<void> {
    if (!this.policy.isDecayEnabled()) return;
    void this.config.get('FLAG_DECAY_HALF_LIFE_DAYS');
  }
}
