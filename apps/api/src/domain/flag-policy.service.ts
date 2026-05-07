import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlagLevel } from '@prisma/client';

@Injectable()
export class FlagPolicyService {
  private readonly watch: number;
  private readonly suspicious: number;
  private readonly highRisk: number;
  private readonly confirmed: number;

  constructor(private readonly config: ConfigService) {
    this.watch = Number(config.get('FLAG_THRESHOLD_WATCH') ?? 1);
    this.suspicious = Number(config.get('FLAG_THRESHOLD_SUSPICIOUS') ?? 3);
    this.highRisk = Number(config.get('FLAG_THRESHOLD_HIGH_RISK') ?? 10);
    this.confirmed = Number(config.get('FLAG_THRESHOLD_CONFIRMED') ?? 25);
  }

  levelFromScore(score: number): FlagLevel {
    if (score >= this.confirmed) return FlagLevel.CONFIRMED_CHEATER;
    if (score >= this.highRisk) return FlagLevel.HIGH_RISK;
    if (score >= this.suspicious) return FlagLevel.SUSPICIOUS;
    if (score >= this.watch) return FlagLevel.WATCH;
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

  /**
   * Trusted /flag tier → weight. Defaults align with `FLAG_THRESHOLD_*` (same keys as level thresholds).
   */
  trustedCommandWeightForSeverity(level: FlagLevel): number {
    const watch = Number(
      this.config.get('FLAG_WEIGHT_TIER_WATCH') ?? this.watch,
    );
    const suspicious = Number(
      this.config.get('FLAG_WEIGHT_TIER_SUSPICIOUS') ?? this.suspicious,
    );
    const highRisk = Number(
      this.config.get('FLAG_WEIGHT_TIER_HIGH_RISK') ?? this.highRisk,
    );
    const confirmed = Number(
      this.config.get('FLAG_WEIGHT_TIER_CONFIRMED') ?? this.confirmed,
    );
    switch (level) {
      case FlagLevel.WATCH:
        return watch;
      case FlagLevel.SUSPICIOUS:
        return suspicious;
      case FlagLevel.HIGH_RISK:
        return highRisk;
      case FlagLevel.CONFIRMED_CHEATER:
        return confirmed;
      case FlagLevel.CLEAN:
      default:
        return watch;
    }
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
