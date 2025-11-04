import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger, NotFoundException, ValidationPipe } from '@nestjs/common';
import { TransformHttpResponseInterceptor } from './common/interceptors/http-response.interceptor';
import { WsRedisIoAdapter } from './ws/adapter/ws-redis.adapter';
import { InternalLogFilter } from './common/logger/internal-log-filter';
import fastifyMultipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';

async function bootstrap() {
  console.log('🚀 Starting NestJS application...');
  console.log('📊 Environment check:');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- PORT:', process.env.PORT);
  console.log('- DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('- REDIS_URL exists:', !!process.env.REDIS_URL);
  console.log('- APP_SECRET exists:', !!process.env.APP_SECRET);
  
  let app: NestFastifyApplication;
  try {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        ignoreTrailingSlash: true,
        ignoreDuplicateSlashes: true,
        maxParamLength: 1000,
        trustProxy: true,
      }),
      {
        rawBody: true,
        logger: new InternalLogFilter(),
      },
    );
    
    // Disable NestJS default 404 handler so we can use our own for SPA routing
    const httpAdapter = app.getHttpAdapter();
    const fastifyInstance = httpAdapter.getInstance();
    // Remove any existing not-found handler that NestJS might have set
    if (fastifyInstance.hasNotFoundHandler) {
      try {
        fastifyInstance.setNotFoundHandler(async () => {});
      } catch (e) {
        // Ignore if already set
      }
    }
    console.log('✅ NestJS application created successfully');
  } catch (error) {
    console.error('❌ Failed to create NestJS application:', error);
    throw error;
  }

  app.setGlobalPrefix('api', {
    exclude: ['robots.txt', 'share/:shareId/p/:pageSlug'],
  });

  const reflector = app.get(Reflector);
  
  // Redis connection with error handling
  try {
    console.log('🔄 Attempting Redis connection...');
    const redisIoAdapter = new WsRedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    console.log('✅ Redis WebSocket adapter connected successfully');
  } catch (error) {
    console.error('❌ Redis connection failed, continuing without WebSocket adapter:', error);
    // Continue without Redis for basic functionality
  }

  console.log('🔄 Registering middleware...');
  await app.register(fastifyMultipart);
  await app.register(fastifyCookie);
  console.log('✅ Middleware registered successfully');

  app
    .getHttpAdapter()
    .getInstance()
    .decorateReply('setHeader', function (name: string, value: unknown) {
      this.header(name, value);
    })
    .decorateReply('end', function () {
      this.send('');
    })
    .addHook('preHandler', function (req, reply, done) {
      // don't require workspaceId for the following paths
      const excludedPaths = [
        '/api/auth/setup',
        '/api/health',
        '/api/billing/stripe/webhook',
        '/api/workspace/check-hostname',
        '/api/sso/google',
        '/api/workspace/create',
        '/api/workspace/joined',
      ];

      if (
        req.originalUrl.startsWith('/api') &&
        !excludedPaths.some((path) => req.originalUrl.startsWith(path))
      ) {
        if (!req.raw?.['workspaceId'] && req.originalUrl !== '/api') {
          throw new NotFoundException('Workspace not found');
        }
        done();
      } else {
        done();
      }
    });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      stopAtFirstError: true,
      transform: true,
    }),
  );

  // Configure CORS to allow all origins (simplified for Railway deployment)
  // In production, Railway handles routing, so we allow all origins
  app.enableCors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
  app.useGlobalInterceptors(new TransformHttpResponseInterceptor(reflector));
  app.enableShutdownHooks();

  const logger = new Logger('NestApplication');

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`UnhandledRejection, reason: ${reason}`, promise);
  });

  process.on('uncaughtException', (error) => {
    logger.error('UncaughtException:', error);
  });

  const port = process.env.PORT || 8080;
  console.log(`🌐 Attempting to start server on port ${port}...`);
  
  try {
    await app.listen(port, '0.0.0.0', () => {
      console.log('✅ Server started successfully!');
      logger.log(
        `Listening on http://127.0.0.1:${port} / ${process.env.APP_URL}`,
      );
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    throw error;
  }
}

bootstrap().catch((error) => {
  console.error('💥 Bootstrap failed:', error);
  process.exit(1);
});
