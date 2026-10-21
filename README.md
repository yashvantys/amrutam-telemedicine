Amrutam Telemedicine Backend
A TypeScript-based backend for a telemedicine platform, providing a
foundation for patient and doctor accounts, appointment booking,
prescriptions, and related healthcare workflows.
Project status: In progress. The booking service has unit/API
tests and PostgreSQL integration tests for concurrency, idempotent
retries, transaction rollback, and idempotency-key conflicts.

Features

- Patient, doctor, and administrator roles.
- User profiles and doctor information.
- Doctor availability slots.
- Appointment and consultation booking.
- PostgreSQL transactions through Prisma.
- Protection against double-booking.
- Idempotency support for booking requests.
- Prescription workflows.
- Payment-related data models.
- Audit logging model.
- Unit/API tests and PostgreSQL integration tests.
  The project is actively evolving; inspect the current route files for
  the exact API surface.
  Technology Stack
- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma ORM 7
- @prisma/adapter-pg
- Vitest and Supertest
- JWT authentication, where configured
  Prerequisites
- Node.js compatible with the project's dependencies
- npm
- PostgreSQL
- Git
  Getting Started

1. Clone the repository:
   git clone <your-repository-url>
   cd amrutam-telemedicine
   Replace <your-repository-url> with the actual repository URL.
2. Install dependencies:
   npm install
3. Create a local .env file using the environment variable names
   below.
4. Configure PostgreSQL and apply the existing Prisma migrations.
5. Generate the Prisma client and start the application using scripts
   defined in package.json.
   Environment Variables
   The following is an illustrative template. Keep only variables used by
   your application and add any additional required variables referenced in
   the source code.
   DATABASE_URL="postgresql://<user>:<password>@localhost:5432/amrutam_db?schema=public"
   DATABASE_TEST_URL="postgresql://<user>:<password>@localhost:5432/amrutam_test_db?schema=public"

JWT_ACCESS_SECRET="<use-a-long-random-secret>"
JWT_REFRESH_SECRET="<use-a-different-long-random-secret>"

PORT=3000
NODE_ENV=development
Do not commit .env files or real credentials. URL-encode special
characters in database credentials when needed.
Database Setup
The project uses Prisma 7 with PostgreSQL.

1. Ensure PostgreSQL is running and the development database exists.
2. Configure DATABASE_URL in .env.
3. Apply migrations:
   npx prisma migrate deploy
4. Generate the Prisma client if required:
   npx prisma generate
   Prisma 7 datasource configuration is defined through the project's
   Prisma configuration file. Use the existing prisma7.config.ts and
   schema.
   Integration-test database safety
   Integration tests should use the dedicated amrutam_test_db database,
   never the development or production database. The integration
   configuration validates the database name.

If your Prisma configuration selects the test database through
PRISMA_TEST_DATABASE, use PowerShell:
$env:PRISMA_TEST_DATABASE = "true"
npx prisma migrate deploy
Remove-Item Env:PRISMA_TEST_DATABASE
Verify the datasource shown in the command output before applying
migrations. Never run test cleanup against development or production
data.

Available Scripts

Check package.json for the authoritative list of scripts. Common
verification commands used in this project include:
npm test
npm run test:integration
npx tsc --noEmit
npm run build
If a script is missing from package.json, add it before using the
corresponding command.
Testing
Unit and API tests
npm test
PostgreSQL integration tests
npm run test:integration

The booking integration suite currently covers:

1. Concurrent booking: only one patient can book a particular slot.
2. Idempotent retry: repeating the same request returns the
   original response without creating a duplicate consultation.
3. Transaction rollback: a failed booking does not leave an
   idempotency record behind.
4. Idempotency conflict: reusing a key with a different payload is
   rejected.
   The latest reported integration-test result was 4 tests passed.
   Re-run the commands above after changes to verify the current state.
   Booking Reliability
   The booking flow is designed to protect against common consistency
   problems:

- Concurrency control: prevents two patients from successfully
  booking the same slot.
- Transactions: groups related database writes so a failed
  operation can roll back.
- Idempotency: safely handles client retries.
- Request fingerprinting: detects reuse of an idempotency key with
  a different payload.
- Integration tests: verifies critical behavior against
  PostgreSQL, not only mocked database calls.
  Review the booking service and tests together when changing transaction
  behavior, idempotency rules, or slot state transitions.

  Project Structure

  The exact structure may evolve. Current areas include:
  amrutam-telemedicine/
  ├── prisma/
  │ ├── migrations/
  │ └── schema.prisma
  ├── src/
  │ ├── config/
  │ ├── generated/
  │ │ └── prisma/
  │ ├── modules/
  │ │ ├── bookings/
  │ │ └── prescriptions/
  │ └── utils/
  ├── tests/
  │ ├── setup.ts
  │ └── integration/
  │ ├── booking.integration.test.ts
  │ └── prisma-test-client.ts
  ├── prisma7.config.ts
  ├── vitest.config.ts
  ├── vitest.integration.config.ts
  ├── package.json
  └── README.md
  
