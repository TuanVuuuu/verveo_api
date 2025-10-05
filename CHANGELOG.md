# Changelog

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
