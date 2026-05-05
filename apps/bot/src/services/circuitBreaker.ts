export class CircuitBreaker {
  private failures = 0;
  private openedUntil = 0;

  constructor(
    private readonly threshold: number,
    private readonly openMs: number,
  ) {}

  beforeCall(): void {
    if (Date.now() < this.openedUntil) {
      throw new Error('CIRCUIT_OPEN');
    }
  }

  recordSuccess(): void {
    this.failures = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openedUntil = Date.now() + this.openMs;
      this.failures = 0;
    }
  }
}
