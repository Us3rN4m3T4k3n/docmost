# Coding Conventions

**Analysis Date:** 2026-03-19

## Naming Patterns

**Files:**
- Controllers: `[feature].controller.ts` (e.g., `auth.controller.ts`)
- Services: `[feature].service.ts` (e.g., `auth.service.ts`)
- DTOs: `[feature].dto.ts` (e.g., `login.dto.ts`, `create-admin-user.dto.ts`)
- Utilities: `[feature].util.ts` or `[feature].utils.ts`
- Constants: `[feature].constants.ts`
- Modules: `[feature].module.ts`
- Strategies: `[feature].strategy.ts`
- Guards: `[feature].guard.ts`
- React components: `kebab-case.tsx` (e.g., `api-key-table.tsx`)
- Custom hooks: `use-[feature].ts` or `use-[feature].tsx` (e.g., `use-tree-mutation.ts`)

**Functions:**
- camelCase for all function names
- Verb prefix for function names: `getUser()`, `createPage()`, `deleteComment()`, `updateWorkspace()`
- Private methods prefixed with underscore not used (follows NestJS convention)
- Handler functions use pattern: `on[Event]Handler` or `[action]Handler` (e.g., `onCreate`, `onUpdate`)

**Variables:**
- camelCase for all variable names
- Constants in UPPER_SNAKE_CASE (e.g., `UserTokenType` or in separate constants files)
- Boolean variables prefixed with `is` or `has` (e.g., `isLoading`, `hasPermission`, `isMfaEnforced`)
- Array variables typically plural (e.g., `apiKeys`, `users`)

**Types:**
- PascalCase for interfaces, types, and classes
- DTO suffix for data transfer objects: `LoginDto`, `CreateAdminUserDto`, `ChangePasswordDto`
- Entity types in uppercase: `User`, `Workspace`, `Page`, `UserToken`
- Interface prefix with `I` rarely used; most types named directly (e.g., `IApiKey`)
- Atom names suffix with `Atom` for Jotai state (e.g., `treeDataAtom`)

## Code Style

**Formatting:**
- Prettier configured with `singleQuote: true` and `trailingComma: "all"`
- 2-space indentation used throughout
- Files end with newlines
- No formatter config in client app (uses server's prettier config)

**Linting:**
- ESLint with TypeScript support in both server and client
- Server: Uses `eslint.config.mjs` with latest ESLint flat config
- Client: Uses `eslint.config.mjs` with React, React Hooks, and React Refresh plugins

**Disabled/Relaxed Rules:**
- `@typescript-eslint/no-explicit-any`: off (allows `any` type)
- `@typescript-eslint/no-unused-vars`: off
- `@typescript-eslint/ban-ts-comment`: off (allows `@ts-ignore` and similar)
- `@typescript-eslint/no-empty-object-type`: off
- `prefer-rest-params`: off
- `no-useless-catch`: off
- `no-useless-escape`: off
- Client-specific: `react-hooks/exhaustive-deps`: off

**TypeScript Configuration:**
- Server strict mode enabled but `strictNullChecks: false`, `noImplicitAny: false`
- Client strict mode disabled: `strict: false`, `strictNullChecks: false`, `noUnusedLocals: false`, `noUnusedParameters: false`
- Both use experimental decorators for NestJS compatibility

## Import Organization

**Order:**
1. External package imports (NestJS, class-validator, third-party libraries)
2. Internal absolute imports using path aliases
3. Local relative imports

**Path Aliases:**

Server:
```typescript
@docmost/db/*       → ./src/database/*
@docmost/transactional/*  → ./src/integrations/transactional/*
@docmost/ee/*       → ./src/ee/*
```

Client:
```typescript
@/*  → ./src/*
```

**Example Server Import Pattern:**
```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { UserTokenType } from '../auth.constants';
import { comparePasswordHash } from '../../../common/helpers';
```

**Example Client Import Pattern:**
```typescript
import { useTranslation } from "react-i18next";
import { IApiKey } from "@/ee/api-key";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
```

## Error Handling

**Patterns:**

Server exceptions thrown via NestJS exception classes:
- `BadRequestException` for invalid input/validation errors
- `UnauthorizedException` for authentication failures
- `ForbiddenException` for authorization failures
- `NotFoundException` for missing resources

**Example:**
```typescript
if (!user || user?.deletedAt) {
  throw new UnauthorizedException('Email or password does not match');
}

if (!user || user.deletedAt) {
  throw new NotFoundException('User not found');
}
```

**Client:**
- Try-catch blocks with Error throwing for promise-based operations
- Example: `throw new Error("Failed to create page")` in mutation handlers

## Logging

**Framework:**
- Server: NestJS built-in `Logger` class
- Client: `console` (no explicit logging framework)

**Patterns:**

Server:
```typescript
private readonly logger = new Logger(AuthController.name);
this.logger.debug('MFA module requested but EE module not bundled');
```

Usage levels observed:
- `debug()` for detailed diagnostic information
- Usage is sparse; logging appears selective

## Comments

**When to Comment:**
- Conditional logic explaining business rules: "Check if user has MFA enabled or workspace enforces MFA"
- Complex calculations or non-obvious code
- Comments are minimal; code is expected to be self-documenting through naming

**JSDoc/TSDoc:**
- Not extensively used in the codebase
- DTOs and interfaces lack JSDoc comments
- Service methods generally lack JSDoc documentation

## Function Design

**Size:**
- Functions are typically small (10-40 lines) for services
- Larger functions reserved for complex business logic (e.g., auth flows with MFA handling)

**Parameters:**
- Use DTO objects for multiple parameters: `LoginDto`, `ChangePasswordDto`
- Optional parameters marked with `?` in types
- Default values used for optional props in React components

**Return Values:**
- Services return entity types (User, Workspace) or void for mutations
- Promise-based async/await pattern throughout
- React components return JSX.Element or null

## Module Design

**Exports:**

NestJS Modules:
```typescript
@Module({
  imports: [TokenModule, WorkspaceModule],
  controllers: [AuthController],
  providers: [AuthService, SignupService, JwtStrategy],
  exports: [SignupService],
})
export class AuthModule {}
```

- Controllers handle HTTP routes
- Services contain business logic
- Modules define exports for cross-module usage

**Barrel Files:**
- Not extensively used; imports use full paths
- Example: Direct import from `@/ee/api-key` type definition
- Workspace uses monorepo structure with explicit package imports

---

*Convention analysis: 2026-03-19*
