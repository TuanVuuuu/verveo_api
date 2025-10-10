export type ErrorEntry = {
  message: string;
  http?: number;
};

// Enum-like keys for type-safe usage (declare BEFORE usage)
export enum ErrorKey {
  Internal = 'error.internal',
  RequestInvalid = 'error.request.invalid',
  Forbidden = 'error.forbidden',
  Unauthorized = 'error.unauthorized',

  AuthUserExists = 'error.auth.user_exists',
  AuthInvalidCredentials = 'error.auth.invalid_credentials',
  AuthCurrentPasswordIncorrect = 'error.auth.current_password_incorrect',
  AuthEmailNotVerified = 'error.auth.email_not_verified',
  AuthInvalidToken = 'error.auth.invalid_token',
  AuthTokenExpired = 'error.auth.token_expired',
  AuthResetTokenExpired = 'error.auth.reset_token_expired',

  TodoNotFound = 'error.todo.not_found',
}

export const ERROR_CATALOG: Record<ErrorKey, ErrorEntry> = {
  // Generic
  [ErrorKey.Internal]: { message: 'Internal Server Error', http: 500 },
  [ErrorKey.RequestInvalid]: { message: 'Invalid request format', http: 422 },
  [ErrorKey.Forbidden]: { message: 'Forbidden', http: 403 },
  [ErrorKey.Unauthorized]: { message: 'Unauthorized', http: 401 },

    // Auth
    [ErrorKey.AuthUserExists]: { message: 'User already exists', http: 409 },
    [ErrorKey.AuthInvalidCredentials]: { message: 'Invalid email or password', http: 401 },
    [ErrorKey.AuthCurrentPasswordIncorrect]: { message: 'Current password is incorrect', http: 403 },
    [ErrorKey.AuthEmailNotVerified]: { message: 'Please verify your email first', http: 403 },
    [ErrorKey.AuthInvalidToken]: { message: 'Invalid token', http: 401 },
    [ErrorKey.AuthTokenExpired]: { message: 'Token has expired', http: 401 },
    [ErrorKey.AuthResetTokenExpired]: { message: 'Reset token has expired', http: 401 },

  // Todos
  [ErrorKey.TodoNotFound]: { message: 'Todo not found or access denied', http: 404 },
};

export const getErrorMessage = (key: ErrorKey | string, fallback?: string) => {
  const catalog = ERROR_CATALOG as unknown as Record<string, ErrorEntry>;
  return catalog[String(key)]?.message || fallback || String(key);
};

export const getHttpStatus = (key: ErrorKey | string, fallback = 500) => {
  const catalog = ERROR_CATALOG as unknown as Record<string, ErrorEntry>;
  return catalog[String(key)]?.http || fallback;
};


