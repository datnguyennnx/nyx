---
name: react-vite-conventions
description: Enforce strict naming conventions, detect typos, and maintain code consistency in React 19+ / Vite 8+ codebases.
---

# Purpose
Detect naming convention violations, typos in variables/components, and structural inconsistencies to maintain a clean codebase.

# Use when
Reviewing any code changes or scanning the repository to ensure:
- Variables, functions, and components follow standard casing conventions.
- No spelling mistakes or typos exist in exports, props, or function names.
- File naming matches component naming.

# Core Principles
- **Components**: PascalCase (e.g., `UserProfile.tsx`, `function UserProfile`)
- **Hooks**: camelCase starting with `use` (e.g., `useAuth`)
- **Functions/Variables**: camelCase (e.g., `fetchData`, `userData`)
- **Constants**: UPPER_SNAKE_CASE for global constants (e.g., `MAX_RETRY_COUNT`)
- **Types/Interfaces**: PascalCase, no `I` prefix (e.g., `UserData`, not `IUserData`)
- **Files**:
  - Component files: PascalCase (`Button.tsx`)
  - Utility/Hook files: camelCase (`useFetch.ts`, `formatDate.ts`)

# Anti-patterns
- **Typo in Props/State**: e.g., `setUesrData` instead of `setUserData`, `isLodaing` instead of `isLoading`.
- **Mismatch File/Component Name**: File `userProfile.tsx` exporting component `UserProfile`.
- **Prefixing Types**: Using `IUser` or `TUser` instead of `User`.
- **Boolean Naming**: Booleans not starting with `is`, `has`, `should`, or `can` (e.g., `loading` instead of `isLoading`).
- **Handler Naming**: Event handlers not using `handle` prefix (e.g., `submitForm` instead of `handleSubmit`).

# Output Contract
Return findings with:
- File location and line numbers
- Specific violation (Typo / Naming Convention)
- Recommended fix
- Risk level (Always LOW for conventions, unless it breaks an export)
