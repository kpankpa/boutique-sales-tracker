export class AppError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}
