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

  ThemeNotFound = 'error.theme.not_found',
  ThemeAlreadyExists = 'error.theme.already_exists',
}

export const ERROR_CATALOG: Record<ErrorKey, ErrorEntry> = {
  // Generic
  [ErrorKey.Internal]: { message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.', http: 500 },
  [ErrorKey.RequestInvalid]: {
    message: 'Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại.',
    http: 422,
  },
  [ErrorKey.Forbidden]: {
    message: 'Tài khoản không có quyền truy cập tính năng này.',
    http: 403,
  },
  // Theo yêu cầu: chỉ dùng 401 cho trường hợp token hết hạn
  // Các trường hợp thiếu token / không có quyền → dùng 403
  [ErrorKey.Unauthorized]: {
    message: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
    http: 403,
  },

  // Auth
  [ErrorKey.AuthUserExists]: {
    message: 'Email này đã được sử dụng. Vui lòng đăng nhập bằng tài khoản hiện có.',
    http: 409,
  },
  // Sai email/mật khẩu → 400 (bad request), không phải 401 (chỉ dùng cho token hết hạn)
  [ErrorKey.AuthInvalidCredentials]: {
    message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
    http: 400,
  },
  [ErrorKey.AuthCurrentPasswordIncorrect]: {
    message: 'Mật khẩu cũ không đúng.',
    http: 403,
  },
  [ErrorKey.AuthEmailNotVerified]: {
    message: 'Email chưa được xác thực. Vui lòng kiểm tra hộp thư của bạn.',
    http: 403,
  },
  // Token không hợp lệ (verify social, verify email, reset password) → 400
  [ErrorKey.AuthInvalidToken]: {
    message: 'Phiên xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.',
    http: 400,
  },
  // ❗ Chỉ trường hợp này giữ 401 theo yêu cầu
  [ErrorKey.AuthTokenExpired]: {
    message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    http: 401,
  },
  // Reset token hết hạn → 400 (bad request) thay vì 401
  [ErrorKey.AuthResetTokenExpired]: {
    message: 'Link đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu link mới.',
    http: 400,
  },

  // Todos
  [ErrorKey.TodoNotFound]: {
    message: 'Công việc không tồn tại hoặc đã bị xoá.',
    http: 404,
  },

  // Themes
  [ErrorKey.ThemeNotFound]: {
    message: 'Theme không tồn tại hoặc đã bị xoá.',
    http: 404,
  },
  [ErrorKey.ThemeAlreadyExists]: {
    message: 'Theme đã tồn tại.',
    http: 409,
  },
};

export const getErrorMessage = (key: ErrorKey | string, fallback?: string) => {
  const catalog = ERROR_CATALOG as unknown as Record<string, ErrorEntry>;
  return catalog[String(key)]?.message || fallback || String(key);
};

export const getHttpStatus = (key: ErrorKey | string, fallback = 500) => {
  const catalog = ERROR_CATALOG as unknown as Record<string, ErrorEntry>;
  return catalog[String(key)]?.http || fallback;
};


