import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlagLevel } from '@prisma/client';

@Injectable()
export class FlagPolicyService {
  private readonly suspicious: number;
  private readonly highRisk: number;
  private readonly confirmed: number;

  constructor(private readonly config: ConfigService) {
    this.suspicious = Number(config.get('FLAG_THRESHOLD_SUSPICIOUS') ?? 1);
    this.highRisk = Number(config.get('FLAG_THRESHOLD_HIGH_RISK') ?? 10);
    this.confirmed = Number(config.get('FLAG_THRESHOLD_CONFIRMED') ?? 25);
  }

  levelFromScore(score: number): FlagLevel {
    if (score >= this.confirmed) return FlagLevel.CONFIRMED_CHEATER;
    if (score >= this.highRisk) return FlagLevel.HIGH_RISK;
    if (score >= this.suspicious) return FlagLevel.SUSPICIOUS;
    return FlagLevel.CLEAN;
  }

  flagWeightFromTrustLevel(trustLevel: number): number {
    const mult = Number(this.config.get('FLAG_WEIGHT_MULTIPLIER') ?? 5);
    const cap = Number(this.config.get('FLAG_WEIGHT_CAP') ?? 50);
    return Math.min(Math.max(1, trustLevel * mult), cap);
  }

  communityReportWeight(): number {
    return Number(this.config.get('FLAG_WEIGHT_COMMUNITY_REPORT') ?? 1);
  }

  adminOverrideWeight(): number {
    return Number(this.config.get('FLAG_WEIGHT_ADMIN_OVERRIDE') ?? 100);
  }

  isDecayEnabled(): boolean {
    return this.config.get<string>('FLAG_DECAY_ENABLED') === 'true';
  }

  /** Half-life in days for exponential decay (worker reads `FLAG_DECAY_HALF_LIFE_DAYS`). */
  decayHalfLifeDays(): number {
    return Number(this.config.get('FLAG_DECAY_HALF_LIFE_DAYS') ?? 30);
  }
}
