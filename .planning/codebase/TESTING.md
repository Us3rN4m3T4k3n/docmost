# Testing Patterns

**Analysis Date:** 2026-03-19

## Test Framework

**Runner:**
- Jest 29.7.0
- Config location: Server uses inline config in `package.json`, E2E uses `test/jest-e2e.json`

**Assertion Library:**
- Jest built-in expect() (no separate assertion library)

**Run Commands:**
```bash
pnpm test              # Run all unit tests
pnpm test:watch       # Watch mode for tests
pnpm test:cov         # Coverage report
pnpm test:debug       # Debug mode with inspector
pnpm test:e2e         # Run E2E tests
```

## Test File Organization

**Location:**
- Co-located: Test files live alongside source code
- Pattern: `.spec.ts` for unit tests, `.e2e-spec.ts` for E2E tests

**Naming:**
- `[feature].spec.ts` for unit tests (e.g., `auth.service.spec.ts`)
- `[feature].e2e-spec.ts` for E2E tests (e.g., `app.e2e-spec.ts`)

**Structure:**
```
src/
├── core/
│   ├── auth/
│   │   ├── auth.controller.spec.ts
│   │   ├── auth.controller.ts
│   │   ├── services/
│   │   │   ├── auth.service.spec.ts
│   │   │   └── auth.service.ts
```

## Test Structure

**Suite Organization:**

```typescript
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

**Patterns:**
- NestJS `Test.createTestingModule()` for dependency injection setup
- `beforeEach()` for test suite initialization
- `module.get<ServiceType>(ServiceName)` for retrieving tested service
- Basic "should be defined" tests for existence verification

**Controller Test Pattern:**
```typescript
describe('PageController', () => {
  let controller: PageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PageController],
      providers: [PageService],
    }).compile();

    controller = module.get<PageController>(PageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

## Mocking

**Framework:**
- Jest built-in mocking via `jest.mock()` and `jest.spyOn()`
- NestJS Testing Module allows provider substitution

**Patterns:**

Dependency injection via module creation:
```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    AuthService,
    {
      provide: UserRepo,
      useValue: mockUserRepo,
    },
  ],
}).compile();
```

**What to Mock:**
- Database repositories (UserRepo, UserTokenRepo, etc.)
- External services (MailService, EnvironmentService)
- Authentication strategies and guards

**What NOT to Mock:**
- Core business logic services being tested
- Basic NestJS decorators and utilities
- DTOs and type definitions

## Fixtures and Factories

**Test Data:**
- No dedicated fixture files found
- Test data typically created inline within test blocks
- Example: Creating test users and workspaces inline as needed

**Location:**
- Not centralized; test data embedded in test files
- Could be improved with factory functions in separate `fixtures/` or `factories/` directory

## Coverage

**Requirements:**
- No enforced coverage targets detected
- Coverage directory: `../coverage` (relative to source root)

**View Coverage:**
```bash
pnpm test:cov
```

## Test Types

**Unit Tests:**
- Scope: Individual service, controller, or utility function testing
- Approach: NestJS Testing Module with dependency injection
- Current state: Minimal unit tests; many contain only "should be defined" assertions
- Providers tested in isolation with mocked dependencies

**Integration Tests:**
- Scope: Not extensively used
- Approach: Could involve multiple services and repositories
- Current state: Limited integration test coverage observed

**E2E Tests:**
- Framework: NestJS Testing Module with `supertest` for HTTP testing
- Configuration file: `test/jest-e2e.json`
- Pattern: Creates full NestJS application and tests HTTP endpoints

**E2E Test Pattern:**
```typescript
describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
```

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operations', async () => {
  const result = await service.someAsyncMethod();
  expect(result).toBeDefined();
});
```

**Promise-based testing in E2E:**
```typescript
return request(app.getHttpServer())
  .get('/endpoint')
  .expect(200);
```

**Error Testing:**
Error testing not extensively present in observed test files. Expected pattern would be:
```typescript
it('should throw UnauthorizedException on invalid credentials', async () => {
  await expect(service.login(invalidDto, workspaceId))
    .rejects
    .toThrow(UnauthorizedException);
});
```

## Test Configuration Details

**Jest Configuration (from package.json):**
```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

**E2E Jest Configuration (test/jest-e2e.json):**
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

## Observations and Gaps

**Current State:**
- Tests exist for most modules (controllers and services)
- Tests are minimal, often containing only existence checks ("should be defined")
- No client-side tests detected in React application
- E2E tests minimal; basic application endpoint testing only

**Recommended Improvements:**
- Expand service test coverage with actual business logic assertions
- Add error case testing to verify exception handling
- Implement E2E tests for critical user flows (auth, page creation, collaboration)
- Consider adding client-side tests with React Testing Library or Vitest
- Create test factories/fixtures for common test data setup
- Add integration tests for cross-service scenarios

---

*Testing analysis: 2026-03-19*
