#!/usr/bin/env bats
# Tests for scripts/setup.sh

setup() {
  # Create a temporary test directory
  export TEST_DIR="$(mktemp -d)"
  export ORIGINAL_DIR="/code"

  # Copy setup script to test directory
  mkdir -p "$TEST_DIR/git-cms/scripts"
  cp "$ORIGINAL_DIR/scripts/setup.sh" "$TEST_DIR/git-cms/scripts/setup.sh"
  cp "$ORIGINAL_DIR/package.json" "$TEST_DIR/git-cms/package.json"

  # Create mocks directory
  export PATH="$TEST_DIR/mocks:$PATH"
  mkdir -p "$TEST_DIR/mocks"

  cd "$TEST_DIR/git-cms"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# Helper: Create a mock Docker CLI that passes compose and daemon checks.
mock_docker_working() {
  cat > "$TEST_DIR/mocks/docker" <<'EOF'
#!/bin/bash
# Mock docker that passes all setup checks
if [[ "$1" == "compose" && "$2" == "version" ]]; then
  echo "Docker Compose version v2.0.0"
  exit 0
fi
if [[ "$1" == "info" ]]; then
  echo "Docker info"
  exit 0
fi
echo "Docker version 20.10.0"
exit 0
EOF
  chmod +x "$TEST_DIR/mocks/docker"
}

@test "setup fails if not run from git-cms directory" {
  cd "$TEST_DIR"
  run bash git-cms/scripts/setup.sh
  [ "$status" -eq 1 ]
  [[ "$output" =~ "Please run this from the git-cms root directory" ]]
}

@test "setup checks for docker command" {
  # Remove docker from PATH
  export PATH="/usr/bin:/bin"

  run bash scripts/setup.sh
  [ "$status" -eq 1 ]
  [[ "$output" =~ "Docker not found" ]]
}

@test "setup checks for docker compose availability" {
  cat > "$TEST_DIR/mocks/docker" <<'EOF'
#!/bin/bash
if [[ "$1" == "compose" && "$2" == "version" ]]; then
  exit 1
fi
if [[ "$1" == "info" ]]; then
  echo "Docker info"
  exit 0
fi
echo "Docker version 20.10.0"
exit 0
EOF
  chmod +x "$TEST_DIR/mocks/docker"

  run bash scripts/setup.sh
  [ "$status" -eq 1 ]
  [[ "$output" =~ "Docker Compose not found" ]]
}

@test "setup checks if docker daemon is running" {
  # Mock docker command exists
  cat > "$TEST_DIR/mocks/docker" <<'EOF'
#!/bin/bash
if [[ "$1" == "compose" && "$2" == "version" ]]; then
  echo "Docker Compose version v2.0.0"
  exit 0
fi
if [[ "$1" == "info" ]]; then
  # Simulate daemon not running
  exit 1
fi
echo "Docker version 20.10.0"
exit 0
EOF
  chmod +x "$TEST_DIR/mocks/docker"

  run bash scripts/setup.sh
  [ "$status" -eq 1 ]
  [[ "$output" =~ "Docker daemon not running" ]]
}

@test "setup succeeds when docker prerequisites are met" {
  mock_docker_working

  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Uses published npm packages" ]]
  [[ "$output" =~ "No sibling ../git-stunts checkout required" ]]
  [[ "$output" =~ "Setup complete" ]]
}

@test "setup shows helpful next steps after success" {
  mock_docker_working

  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  [[ "$output" =~ "npm run demo" ]]
  [[ "$output" =~ "npm run quickstart" ]]
  [[ "$output" =~ "npm run dev" ]]
}
