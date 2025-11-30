# Changelog

## [2.0.6] - 2025-01-XX
### Added
- POST `/todos/batch_import`: Batch import multiple todos in a single API call
  - Supports creating 1-100 todos in one request
  - Uses database transaction for all-or-nothing behavior
  - Helps users synchronize data efficiently without multiple API calls
  - Same todo structure as `POST /todos/create-manual` but accepts array of todos
- `createTodosBatch` function in `userService.ts` for batch todo creation with transaction support
- Lunar calendar support in `generateTodoWithDeepseek`
- Automatic conversion from lunar calendar dates to solar calendar dates
- Utility functions for lunar calendar conversion (`convertLunarToSolar`, `getCurrentLunarDate`)
- Integration with `@nghiavuive/lunar_date_vi` library for accurate lunar calendar calculations

### Changed
- POST `/todos` now returns AI-generated todo response without saving to database
- Only POST `/todos/create-manual` saves todos to database
- Enhanced AI prompts to understand and process lunar calendar dates
- System prompt now includes instructions for handling lunar calendar dates
- User prompt now includes current lunar calendar date information
- Enhanced todo creation workflow with batch import capability
- Improved data synchronization support for client applications

### Technical Details
- Batch import uses MySQL transactions to ensure data consistency
- If any todo creation fails, entire batch is rolled back
- Response returns array of created todos in the same order as request
- Each todo in batch gets `created_by="User"`, `confidence=1`, `progress="todo"` by default
- When user mentions lunar calendar dates (e.g., "mùng 1 âm", "ngày rằm", "15 âm"), AI will:
  1. Recognize the lunar calendar date from the prompt
  2. Calculate the corresponding solar calendar date
  3. Return todo with solar calendar dates in `startTime` and `endTime`
- Example: If user says "đi chợ vào mùng 1 âm sắp tới", system will convert to the corresponding solar date (e.g., 20/10/2025)

## [2.0.5] - 2025-11-07
### Added
- Brevo (formerly Sendinblue) email service integration
- Replaced Gmail SMTP with Brevo Transactional API
- Domain verification for verveo.click
- IP authorization for API security
- Enhanced email templates with improved styling and branding
- Test email script for local testing

### Changed
- Migrated from nodemailer (Gmail) to @getbrevo/brevo SDK
- Updated email service (`src/services/emailService.ts`) to use Brevo Transactional API
- Enhanced email templates with better styling and responsive design
- Improved email deliverability with domain authentication (SPF, DKIM, DMARC)
- Updated environment variables: Added `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`

### Fixed
- Resolved 401 Unauthorized error by authorizing IP address in Brevo
- Fixed API key authentication in Brevo SDK
- Improved error handling in email service

### Testing
- ✅ Email verification emails sent and received successfully
- ✅ Password reset emails sent and received successfully
- ✅ Local testing completed with test email script

## [2.0.4] - 2025-01-27
### Added
- POST `/auth/forgot-password`: Request password reset email
- POST `/auth/reset-password`: Reset password using token from email
- Password reset functionality with secure token-based flow
- Email service for sending password reset emails
- Database migration for reset password fields (reset_token, reset_token_expiry)

### Changed
- Enhanced authentication system with password recovery
- Updated API_SPEC.md with new password reset endpoints
- Added AuthResetTokenExpired error key to error catalog
- Improved security with token expiration (1 hour)
- Reset password UI converted to English
- Fixed Content Security Policy issues with inline JavaScript
- Separated JavaScript into external file for better security
- Fixed password change UX: incorrect current password now returns 403 instead of 401 to prevent auto-logout

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
