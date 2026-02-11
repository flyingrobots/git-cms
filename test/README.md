# Test Suite

Git CMS has multiple test suites to ensure everything works correctly.

## Test Types

### 1. Setup Script Tests (BATS)

Tests the `scripts/setup.sh` script to ensure it:
- Validates prerequisites correctly
- Handles missing dependencies gracefully
- Confirms npm-package dependency model assumptions
- Provides helpful error messages

**Run:**
```bash
npm run test:setup
```

**What it tests:**
- ✅ Fails if not in git-cms directory
- ✅ Checks for Docker installation
- ✅ Checks for Docker Compose
- ✅ Checks if Docker daemon is running
- ✅ Reports npm-package dependency mode
- ✅ Shows helpful next steps

**Test Environment:**
All tests run in Docker using the `bats/bats` image. Each test:
- Creates a temporary directory
- Mocks external commands (docker)
- Runs the setup script in isolation
- Cleans up afterward

### 2. Integration Tests (Vitest)

Tests the core CMS functionality:
- Article CRUD operations
- Publishing workflow
- Asset encryption and chunking
- Git plumbing operations

**Run:**
```bash
npm test
# OR
npm run test:local  # (not recommended - use Docker)
```

**Files:**
- `test/git.test.js` - Git operations
- `test/chunks.test.js` - Asset encryption
- `test/server.test.js` - HTTP API

### 3. E2E Tests (Playwright)

Tests the web UI end-to-end:
- Creating articles via UI
- Publishing workflow
- Navigation
- Error handling

**Run:**
```bash
npm run test:e2e
```

**Files:**
- `test/e2e/**/*.spec.js`

---

## Running All Tests

```bash
# Run everything
npm run test:setup  # Setup script tests
npm test            # Integration tests
npm run test:e2e    # E2E tests
```

---

## Writing New Tests

### Adding BATS Tests

1. Create or edit `test/setup.bats` (or create new `*.bats` files)
2. Follow BATS syntax:

```bash
@test "description of what this tests" {
  run bash scripts/setup.sh
  [ "$status" -eq 0 ]  # Check exit code
  [[ "$output" =~ "expected string" ]]  # Check output
}
```

3. Run tests: `npm run test:setup`

### Adding Integration Tests

1. Create or edit `test/*.test.js`
2. Use Vitest syntax:

```javascript
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

3. Run tests: `npm test`

---

## Test Helpers

### BATS Test Helpers

Available in `test/setup.bats`:

```bash
setup() {
  # Runs before each test
  export TEST_DIR="$(mktemp -d)"
}

teardown() {
  # Runs after each test
  rm -rf "$TEST_DIR"
}

mock_command() {
  # Create a mock executable
  local cmd="$1"
  local exit_code="${2:-0}"
  local output="${3:-}"
  # ...
}
```

### Integration Test Helpers

Available in test files:

```javascript
// Create temporary Git repo
const repo = await createTestRepo();

// Clean up
await cleanupTestRepo(repo);
```

---

## Debugging Tests

### BATS Tests

```bash
# Run with verbose output
docker run --rm git-cms-setup-tests bats -t /test/setup.bats

# Run specific test
docker run --rm git-cms-setup-tests bats -f "test name" /test/setup.bats
```

### Integration Tests

```bash
# Run specific test file
docker compose run --rm test npm run test:local -- test/git.test.js

# Run in watch mode (inside container)
docker compose run --rm test npm run test:local -- --watch
```

---

## CI/CD Integration

All tests are designed to run in CI environments:

```yaml
# Example GitHub Actions
- name: Run setup tests
  run: npm run test:setup

- name: Run integration tests
  run: npm test

- name: Run E2E tests
  run: npm run test:e2e
```

---

## Test Coverage

Current coverage:

| Component | Coverage | Notes |
|-----------|----------|-------|
| Setup Script | 100% | All branches tested |
| CMS Service | ~80% | Core operations covered |
| HTTP Server | ~70% | API endpoints tested |
| Web UI | ~50% | Critical paths covered |

---

## Safety Notes

All tests run in Docker to ensure:
- ✅ Isolated Git environment
- ✅ No impact on host filesystem
- ✅ Reproducible results
- ✅ Easy cleanup

**Never run tests with `--dangerouslyDisableSandbox` or outside Docker** unless you understand the risks.

---

## More Info

- **BATS Documentation:** https://bats-core.readthedocs.io/
- **Vitest Documentation:** https://vitest.dev/
- **Playwright Documentation:** https://playwright.dev/
