import {
  Controller,
  Get,
  Logger,
  Module,
  Res,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import cookieParser from 'cookie-parser';
import { get as httpGet } from 'node:http';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RequestLoggingMiddleware } from '../src/logging/request-logging.middleware.js';

@Controller('logging-test')
class LoggingTestController {
  @Get(':id')
  success() {
    return { ok: true };
  }

  @Get('failure/trigger')
  fail() {
    throw new Error('simulated unexpected failure');
  }

  @Get('stream/hold')
  stream(@Res() res: Response) {
    res.write('stream started');
  }
}

@Module({ imports: [AppModule], controllers: [LoggingTestController] })
class LoggingTestModule {}

type LogEntry = {
  timestamp: string;
  requestId: string;
  method: string;
  route: string;
  statusCode: number | null;
  durationMs: number;
};

describe('HTTP request logging', () => {
  let app: INestApplication;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  function entries(spy: ReturnType<typeof vi.spyOn>): LogEntry[] {
    return spy.mock.calls.flatMap((args: unknown[]) => {
      if (typeof args[0] !== 'string') return [];
      try {
        const value = JSON.parse(args[0]) as LogEntry;
        return value.requestId ? [value] : [];
      } catch {
        return [];
      }
    });
  }
  function assertEntry(
    entry: LogEntry,
    expected: Partial<LogEntry>,
    requestId: string,
  ) {
    expect(entry).toMatchObject({ ...expected, requestId });
    expect(Object.keys(entry).sort()).toEqual([
      'durationMs',
      'method',
      'requestId',
      'route',
      'statusCode',
      'timestamp',
    ]);
    expect(entry.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
    expect(entry.durationMs).toEqual(expect.any(Number));
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggingTestModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  beforeEach(() => {
    logSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('logs one successful response with a server-generated ID and a route template', async () => {
    const response = await request(app.getHttpServer())
      .get('/logging-test/path-secret-identifier?token=query-secret')
      .set('X-Request-Id', 'client-supplied-secret')
      .set('Cookie', 'session=cookie-secret')
      .set('Authorization', 'Bearer auth-secret')
      .expect(200);
    const logs = entries(logSpy);
    expect(logs).toHaveLength(1);
    assertEntry(
      logs[0],
      { method: 'GET', route: '/logging-test/:id', statusCode: 200 },
      response.headers['x-request-id'],
    );
    expect(response.headers['x-request-id']).not.toBe('client-supplied-secret');
    expect(JSON.stringify(logs)).not.toMatch(
      /query-secret|cookie-secret|auth-secret|client-supplied-secret|path-secret-identifier/,
    );
    expect(entries(warnSpy)).toHaveLength(0);
    expect(entries(errorSpy)).toHaveLength(0);
  });

  it('generates distinct IDs for separate requests', async () => {
    const first = await request(app.getHttpServer()).get('/health').expect(200);
    const second = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(first.headers['x-request-id']).not.toBe(
      second.headers['x-request-id'],
    );
    expect(entries(logSpy)).toHaveLength(2);
  });

  it('logs CORS preflight and regular requests once with bootstrap and module registration', async () => {
    const fixture = await Test.createTestingModule({
      imports: [LoggingTestModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    const bootstrapApp = fixture.createNestApplication();
    const middleware = new RequestLoggingMiddleware();
    bootstrapApp.use(middleware.use.bind(middleware));
    bootstrapApp.enableCors({
      origin: 'http://localhost:5173',
      credentials: true,
    });
    await bootstrapApp.init();
    try {
      const response = await request(bootstrapApp.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);
      expect(entries(logSpy)).toHaveLength(1);
      assertEntry(
        entries(logSpy)[0],
        { method: 'OPTIONS', route: 'UNMATCHED_ROUTE', statusCode: 204 },
        response.headers['x-request-id'],
      );
      const normal = await request(bootstrapApp.getHttpServer())
        .get('/health')
        .expect(200);
      expect(entries(logSpy)).toHaveLength(2);
      assertEntry(
        entries(logSpy)[1],
        { method: 'GET', route: '/health', statusCode: 200 },
        normal.headers['x-request-id'],
      );
    } finally {
      await bootstrapApp.close();
    }
  });

  it('logs validation failures without request body or query secrets', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login?token=query-secret')
      .set('Cookie', 'sprintdesk_session=cookie-secret')
      .send({ email: 'invalid', password: 'password-secret' })
      .expect(400);
    const logs = entries(warnSpy);
    expect(logs).toHaveLength(1);
    assertEntry(
      logs[0],
      { method: 'POST', route: '/auth/login', statusCode: 400 },
      response.headers['x-request-id'],
    );
    expect(JSON.stringify(logs)).not.toMatch(
      /invalid|password-secret|cookie-secret|query-secret/,
    );
  });

  it('logs unauthenticated requests as 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);
    const logs = entries(warnSpy);
    expect(logs).toHaveLength(1);
    assertEntry(
      logs[0],
      { method: 'GET', route: '/auth/me', statusCode: 401 },
      response.headers['x-request-id'],
    );
  });

  it('uses a safe fallback for unmatched routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/sensitive-path-secret?token=query-secret')
      .expect(404);
    const logs = entries(warnSpy);
    expect(logs).toHaveLength(1);
    assertEntry(
      logs[0],
      { method: 'GET', route: 'UNMATCHED_ROUTE', statusCode: 404 },
      response.headers['x-request-id'],
    );
    expect(JSON.stringify(logs)).not.toMatch(
      /sensitive-path-secret|query-secret/,
    );
  });

  it('logs unexpected errors as 500 without exception details in the request log', async () => {
    const response = await request(app.getHttpServer())
      .get('/logging-test/failure/trigger')
      .expect(500);
    const logs = entries(errorSpy);
    expect(logs).toHaveLength(1);
    assertEntry(
      logs[0],
      {
        method: 'GET',
        route: '/logging-test/failure/trigger',
        statusCode: 500,
      },
      response.headers['x-request-id'],
    );
    expect(JSON.stringify(logs)).not.toContain('simulated unexpected failure');
  });

  it('logs an interrupted connection once without a success status', async () => {
    let notify!: () => void;
    const logged = new Promise<void>((resolve) => {
      notify = resolve;
    });
    warnSpy.mockImplementation((message: unknown) => {
      if (typeof message === 'string' && message.includes('"statusCode":null'))
        notify();
    });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as { port: number };
    await new Promise<void>((resolve, reject) => {
      const req = httpGet(
        `http://127.0.0.1:${address.port}/logging-test/stream/hold`,
        (res) => {
          res.once('data', () => {
            res.destroy();
            resolve();
          });
        },
      );
      req.on('error', reject);
    });
    await logged;
    const logs = entries(warnSpy);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      method: 'GET',
      route: '/logging-test/stream/hold',
      statusCode: null,
    });
    expect(entries(logSpy)).toHaveLength(0);
  });
});
