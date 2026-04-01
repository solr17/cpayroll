# API Routes

## Auth

- `POST /api/auth/login` — Login with email/password. Returns session cookie.

## Employees

- `GET /api/employees` — List all employees (Owner/Admin only). Returns masked NRIC.
- `POST /api/employees` — Create employee (Owner/Admin only). NRIC hashed, PII encrypted.
- `GET /api/employees/:id` — Get employee detail with decrypted PII (Owner/Admin only).
- `PATCH /api/employees/:id` — Update employee (Owner/Admin only). Audit logged.
