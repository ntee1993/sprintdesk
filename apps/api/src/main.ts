import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { getCorsOrigin } from './cors.config.js';
import { AppModule } from './app.module.js';
import { RequestLoggingMiddleware } from './logging/request-logging.middleware.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const requestLogging = new RequestLoggingMiddleware();
  app.use(requestLogging.use.bind(requestLogging));
  app.use(cookieParser());
  app.enableCors({
    origin: getCorsOrigin(),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
