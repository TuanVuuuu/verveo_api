import { ErrorKey, getErrorMessage, getHttpStatus } from '../constants/errorCatalog.js';

export class AppError extends Error {
  status: number;
  key: string;
  description?: string;

  constructor(key: ErrorKey, description?: string, status?: number) {
    super(key);
    this.key = key;
    this.status = status ?? getHttpStatus(key);
    this.description = description;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const isAppError = (err: unknown): err is AppError => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    'key' in err
  );
};


export const buildErrorPayload = (statusCode: number, key: string, description?: string) => {
  const desc = description || getErrorMessage(key, key);
  return {
    status: 1,
    message: key,
    data: {
      errorCode: statusCode,
      errorKey: key,
      description: desc
    },
    description: desc
  };
};


