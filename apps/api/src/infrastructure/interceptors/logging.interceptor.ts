import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') ?? '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const duration = Date.now() - startTime;

          if (duration > 1000) {
            this.logger.warn(
              `${method} ${url} ${statusCode} ${duration}ms - ${userAgent} ${ip} [SLOW]`,
            );
          } else {
            this.logger.log(`${method} ${url} ${statusCode} ${duration}ms`);
          }
        },
        error: (err: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(`${method} ${url} ERROR ${duration}ms - ${err.message}`);
        },
      }),
    );
  }
}
