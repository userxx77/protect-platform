import { Injectable } from '@nestjs/common';
import { getDbQueryCount } from '../common/correlation.context';

type LatencySample = { ms: number; at: number };

const MAX_LAT_SAMPLES = 512;
const MAX_DBQ_SAMPLES = 256;

@Injectable()
export class MetricsService {
  private requestTotal = 0;
  private errorTotal = 0;
  private readonly latencies: LatencySample[] = [];
  private readonly dbQueriesPerRequest: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheBypass = 0;
  private startedAt = Date.now();

  recordRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
    dbQueryCount?: number;
  }): void {
    this.requestTotal += 1;
    if (input.statusCode >= 500) {
      this.errorTotal += 1;
    }
    this.latencies.push({ ms: input.durationMs, at: Date.now() });
    if (this.latencies.length > MAX_LAT_SAMPLES) {
      this.latencies.splice(0, this.latencies.length - MAX_LAT_SAMPLES);
    }
    const dq =
      input.dbQueryCount ?? getDbQueryCount() ?? 0;
    this.dbQueriesPerRequest.push(dq);
    if (this.dbQueriesPerRequest.length > MAX_DBQ_SAMPLES) {
      this.dbQueriesPerRequest.splice(
        0,
        this.dbQueriesPerRequest.length - MAX_DBQ_SAMPLES,
      );
    }
  }

  recordCacheHit(): void {
    this.cacheHits += 1;
  }

  recordCacheMiss(): void {
    this.cacheMisses += 1;
  }

  recordCacheBypass(): void {
    this.cacheBypass += 1;
  }

  snapshot(): {
    uptimeSec: number;
    requestsTotal: number;
    errors5xxTotal: number;
    latencyMs: { p50: number | null; p95: number | null; samples: number };
  } {
    return {
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
      requestsTotal: this.requestTotal,
      errors5xxTotal: this.errorTotal,
      latencyMs: this.latencyPercentiles(),
    };
  }

  detailedSnapshot(): {
    uptimeSec: number;
    requestsTotal: number;
    errors5xxTotal: number;
    latencyMs: {
      p50: number | null;
      p95: number | null;
      p99: number | null;
      samples: number;
    };
    cache: {
      hits: number;
      misses: number;
      bypass: number;
      hitRateApprox: number | null;
    };
    dbQueriesPerRequest: {
      avg: number | null;
      p95: number | null;
      samples: number;
    };
  } {
    const lat = this.latencyPercentiles();
    const sorted = [...this.latencies].map((s) => s.ms).sort((a, b) => a - b);
    const n = sorted.length;
    const p99 =
      n === 0
        ? null
        : sorted[Math.min(n - 1, Math.floor(0.99 * n))] ?? null;
    const cacheTotal = this.cacheHits + this.cacheMisses;
    const hitRateApprox =
      cacheTotal === 0 ? null : this.cacheHits / cacheTotal;
    const dqSorted = [...this.dbQueriesPerRequest].sort((a, b) => a - b);
    const dqN = dqSorted.length;
    const dqAvg =
      dqN === 0
        ? null
        : dqSorted.reduce((a, b) => a + b, 0) / dqN;
    const dqP95 =
      dqN === 0
        ? null
        : dqSorted[Math.min(dqN - 1, Math.floor(0.95 * dqN))] ?? null;
    return {
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
      requestsTotal: this.requestTotal,
      errors5xxTotal: this.errorTotal,
      latencyMs: { ...lat, p99, samples: n },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        bypass: this.cacheBypass,
        hitRateApprox,
      },
      dbQueriesPerRequest: {
        avg: dqAvg,
        p95: dqP95,
        samples: dqN,
      },
    };
  }

  private latencyPercentiles(): {
    p50: number | null;
    p95: number | null;
    samples: number;
  } {
    const sorted = [...this.latencies].map((s) => s.ms).sort((a, b) => a - b);
    const n = sorted.length;
    const pct = (p: number) => {
      if (n === 0) return null;
      const idx = Math.min(n - 1, Math.floor((p / 100) * n));
      return sorted[idx] ?? null;
    };
    return {
      p50: pct(50),
      p95: pct(95),
      samples: n,
    };
  }
}
