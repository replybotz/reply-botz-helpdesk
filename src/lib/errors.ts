export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity = 'Resource') {
    super(`${entity} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(
    message = 'Validation failed',
    public errors?: Record<string, string[]>,
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class TenantNotFoundError extends AppError {
  constructor(slug?: string) {
    super(slug ? `Tenant '${slug}' not found` : 'Tenant not found', 404, 'TENANT_NOT_FOUND');
    this.name = 'TenantNotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code, ...(error instanceof ValidationError && error.errors ? { errors: error.errors } : {}) },
      { status: error.statusCode },
    );
  }
  console.error('Unhandled error:', error);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}
