import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';
import type { Response } from 'express';

@Catch()
export class SafeExceptionFilter extends BaseExceptionFilter {
  private readonly safeLogger = new Logger(SafeExceptionFilter.name);

  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      super.catch(exception, host);
      return;
    }
    const response = host.switchToHttp().getResponse<Response>();
    const id = response.getHeader('X-Request-Id');
    const requestId =
      typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined;
    const code =
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      /^P\d{4}$/.test(exception.code)
        ? exception.code
        : undefined;
    const category =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? 'prisma_known_request'
        : exception instanceof TypeError
          ? 'type_error'
          : exception instanceof RangeError
            ? 'range_error'
            : 'unexpected_error';
    this.safeLogger.error(
      JSON.stringify({ event: 'unexpected_error', requestId, category, code }),
    );
    if (response.headersSent) {
      response.end();
      return;
    }
    response
      .status(500)
      .json({ statusCode: 500, message: 'Internal server error' });
  }
}
