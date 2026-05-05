import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { incrementDbQueryCount } from '../common/correlation.context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly queryMetricsEnabled: boolean;

  constructor(config: ConfigService) {
    const queryMetricsEnabled =
      config.get<string>('PRISMA_QUERY_METRICS') === 'true';
    super(
      queryMetricsEnabled
        ? { log: [{ emit: 'event', level: 'query' }] }
        : {},
    );
    this.queryMetricsEnabled = queryMetricsEnabled;
  }

  async onModuleInit() {
    if (this.queryMetricsEnabled) {
      // PrismaClient types omit 'query' when log query events are not in constructor union.
      this.$on(
        'query' as never,
        () => incrementDbQueryCount(),
      );
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
