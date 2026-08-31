// Error classes for domain logic
// Services map these to HTTP status codes in error handlers

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, code = 'NOT_FOUND') {
    super(message, code, 404);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(message, code, 400);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string, code = 'UNAUTHORIZED') {
    super(message, code, 401);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code = 'CONFLICT') {
    super(message, code, 409);
  }
}

export class ServiceUnavailableError extends DomainError {
  constructor(message: string, code = 'SERVICE_UNAVAILABLE') {
    super(message, code, 503);
  }
}
