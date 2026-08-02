import { chromium } from 'playwright';
import type { Browser, BrowserContext } from 'playwright';

/**
 * 브라우저 워밍 풀.
 *
 * Chromium 콜드 스타트는 1~3초다. 요청마다 새로 띄우면
 * 목표 지연(렌더 1건 p50 ≤ 600ms)을 절대 못 맞춘다.
 * 컨텍스트를 재사용하되, 페이지는 요청마다 새로 만들어 상태 오염을 막는다.
 */

export type PoolOptions = {
  size?: number;
  /** 컨텍스트를 몇 번 쓰고 버릴지. 메모리 누수 방어. */
  maxUsesPerContext?: number;
};

type PooledContext = {
  context: BrowserContext;
  uses: number;
};

export class BrowserPool {
  #browser: Browser | null = null;
  #contexts: PooledContext[] = [];
  #waiters: ((c: PooledContext) => void)[] = [];
  readonly #size: number;
  readonly #maxUses: number;
  #starting: Promise<void> | null = null;

  constructor(options: PoolOptions = {}) {
    this.#size = options.size ?? 2;
    this.#maxUses = options.maxUsesPerContext ?? 200;
  }

  async start(): Promise<void> {
    if (this.#browser) {
      return;
    }
    // 동시 호출이 브라우저를 두 번 띄우지 않게 한다.
    this.#starting ??= this.#doStart();
    await this.#starting;
  }

  async #doStart(): Promise<void> {
    this.#browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        // 폰트 렌더링을 플랫폼 간 일관되게
        '--font-render-hinting=none',
        '--disable-lcd-text',
      ],
    });
    for (let i = 0; i < this.#size; i += 1) {
      this.#contexts.push({ context: await this.#createContext(), uses: 0 });
    }
  }

  async #createContext(): Promise<BrowserContext> {
    if (!this.#browser) {
      throw new Error('브라우저가 시작되지 않았습니다');
    }
    return await this.#browser.newContext({
      // deviceScaleFactor는 렌더 배수를 CSS scale로 처리하므로 1로 고정한다.
      // 여기서 배수를 주면 CSS px과 실제 픽셀이 어긋나 좌표 검증이 어려워진다.
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
  }

  /** 컨텍스트를 빌린다. 반드시 release로 반납해야 한다. */
  async acquire(): Promise<PooledContext> {
    await this.start();
    const available = this.#contexts.pop();
    if (available) {
      return available;
    }

    return await new Promise<PooledContext>((resolve) => {
      this.#waiters.push(resolve);
    });
  }

  async release(pooled: PooledContext): Promise<void> {
    pooled.uses += 1;

    // 오래 쓴 컨텍스트는 교체한다 (메모리 누수·상태 축적 방어)
    if (pooled.uses >= this.#maxUses) {
      await pooled.context.close().catch(() => {});
      try {
        pooled = { context: await this.#createContext(), uses: 0 };
      } catch {
        // 재생성 실패 시 풀 크기가 줄어들 뿐, 서비스는 계속 동작한다.
        return;
      }
    }

    const waiter = this.#waiters.shift();
    if (waiter) {
      waiter(pooled);
      return;
    }
    this.#contexts.push(pooled);
  }

  /** 컨텍스트를 빌려 작업하고 자동 반납한다. */
  async withContext<T>(fn: (context: BrowserContext) => Promise<T>): Promise<T> {
    const pooled = await this.acquire();
    try {
      return await fn(pooled.context);
    } finally {
      await this.release(pooled);
    }
  }

  async stop(): Promise<void> {
    this.#waiters = [];
    await Promise.all(this.#contexts.map(async (p) => p.context.close().catch(() => {})));
    this.#contexts = [];
    await this.#browser?.close().catch(() => {});
    this.#browser = null;
    this.#starting = null;
  }

  get isRunning(): boolean {
    return this.#browser !== null;
  }
}
