# Changelog

## [2.0.3] - 2025-01-27
### Fixed
- JWT token expiration now returns 401 with error.auth.token_expired
- Invalid token returns 401 with error.auth.invalid_token
- Better error handling for different JWT error types
- Enhanced authentication middleware with specific JWT error handling

### Changed
- Updated API_SPEC.md with correct error responses
- Added AuthTokenExpired error key to error catalog
- Standardized 401 responses for authentication issues
- Improved error messages for better client understanding

## [2.0.2] - 2025-01-27
### Added
- GET `/auth/me`: Get current user profile
- PUT `/auth/profile`: Update user profile (name and/or password)
- Password change functionality with current password verification
- Enhanced authentication middleware for protected routes
- Complete user profile management system

### Fixed
- Missing authentication routes that were documented in API_SPEC.md
- User profile access and update functionality
- Password change security with current password validation

### Changed
- Enhanced authentication service with profile management
- Improved error handling for authentication operations
- Standardized response format for all authentication endpoints

## [2.0.1] - 2025-10-05
### Added
- POST `/todos/create-manual`: manual todo creation (fallback when AI is unavailable)
  - Same response shape as AI flow
  - `created_by = "User"`, `confidence = 1`
- Centralized error catalog (`ErrorKey`, default messages)
- Standardized error payloads via global error handler

### Changed
- Split routes: `src/routes/auth.ts`, `src/routes/todos.ts`; mounted in `src/index.ts`
- Enhanced todos CRUD to store full AI fields + `progress` (todo → inprogress → done)
- DELETE `/todos/:id` returns deleted todo data
- POST `/todos` returns only saved todo object (no AI metadata)

## [1.0.0] - 2025-10-05
### Added
- Authentication: register, email verification, login (JWT)
- Protected todos CRUD
- Email verification UI + Nginx/HTTPS setup
- Initial docs and deployment scripts
