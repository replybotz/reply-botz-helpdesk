import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

// Shared infrastructure
import { DatabaseModule } from './shared/database/database.module';
import { AppCacheModule } from './shared/cache/cache.module';
import { QueueModule } from './shared/queue/queue.module';
import { EventsModule } from './shared/events/events.module';

// Global infrastructure
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';
import { AllExceptionsFilter } from './infrastructure/filters/all-exceptions.filter';
import { LoggingInterceptor } from './infrastructure/interceptors/logging.interceptor';
import { TransformInterceptor } from './infrastructure/interceptors/transform.interceptor';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { LmsIntegrationsModule } from './modules/lms-integrations/lms-integrations.module';
import { ContentModerationModule } from './modules/content-moderation/content-moderation.module';
import { FerpaComplianceModule } from './modules/ferpa-compliance/ferpa-compliance.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Config — must be first
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Scheduling
    ScheduleModule.forRoot(),

    // Health checks
    TerminusModule,

    // Shared infrastructure (global)
    DatabaseModule,
    AppCacheModule,
    QueueModule,
    EventsModule,

    // Feature modules
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AiGatewayModule,
    LmsIntegrationsModule,
    ContentModerationModule,
    FerpaComplianceModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global JWT auth guard (bypassed by @Public() decorator)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global RBAC guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global response transform
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
