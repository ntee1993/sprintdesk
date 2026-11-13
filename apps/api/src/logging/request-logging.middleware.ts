import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';

const instrumentedResponses = new WeakSet<Response>();

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    // Bootstrap runs before CORS; the module registers the same middleware for test apps.
    if (instrumentedResponses.has(res)) {
      next();
      return;
    }
    instrumentedResponses.add(res);
    const requestId = randomUUID();
    const started = performance.now();
    res.setHeader('X-Request-Id', requestId);
    let logged = false;

    const complete = (finished: boolean) => {
      if (logged) return;
      logged = true;
      // Express assigns route.path from the registered handler, never from the request URL.
      const route: unknown = req.route?.path;
      const entry = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        route:
          typeof route === 'string' && route !== '/{*path}'
            ? route
            : 'UNMATCHED_ROUTE',
        statusCode: finished ? res.statusCode : null,
        durationMs: Math.max(0, performance.now() - started),
      };
      const message = JSON.stringify(entry);
      if (!finished || (res.statusCode >= 400 && res.statusCode < 500)) {
        this.logger.warn(message);
      } else if (res.statusCode >= 500) {
        this.logger.error(message);
      } else {
        this.logger.log(message);
      }
    };

    res.once('finish', () => complete(true));
    res.once('close', () => complete(false));
    next();
  }
}
