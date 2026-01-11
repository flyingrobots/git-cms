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

# Helper: Create a mock Docker that works
mock_docker_working() {
  cat > "$TEST_DIR/mocks/docker" <<'EOF'
#!/bin/bash
# Mock docker that passes all checks
if [[ "$1" == "info" ]]; then
  echo "Docker info"
  exit 0
fi
echo "Docker version 20.10.0"
exit 0
EOF
  chmod +x "$TEST_DIR/mocks/docker"
}

# Helper: Create mock git that succeeds at cloning
mock_git_clone_success() {
  local test_dir="$TEST_DIR"
  cat > "$TEST_DIR/mocks/git" <<EOF
#!/bin/bash
if [[ "\$1" == "clone" ]]; then
  mkdir -p "$test_dir/git-stunts"
  echo "Cloning into 'git-stunts'..."
  exit 0
fi
exit 0
EOF
  chmod +x "$TEST_DIR/mocks/git"
}

# Helper: Create mock git that fails at cloning
mock_git_clone_fail() {
  cat > "$TEST_DIR/mocks/git" <<'EOF'
#!/bin/bash
if [[ "$1" == "clone" ]]; then
  echo "fatal: repository not found"
  exit 128
fi
exit 0
EOF
  chmod +x "$TEST_DIR/mocks/git"
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

@test "setup checks if docker daemon is running" {
  # Mock docker command exists
  cat > "$TEST_DIR/mocks/docker" <<'EOF'
#!/bin/bash
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

@test "setup succeeds if git-stunts already exists" {
  mock_docker_working

  # Create git-stunts directory
  mkdir -p "$TEST_DIR/git-stunts"

  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  [[ "$output" =~ "git-stunts found" ]]
  [[ "$output" =~ "Setup complete" ]]
}

@test "setup offers to clone git-stunts if not found" {
  mock_docker_working

  # Don't create git-stunts
  # Simulate user declining (send 'n' to stdin)
  run bash scripts/setup.sh <<< "n"
  [ "$status" -eq 1 ]
  [[ "$output" =~ "git-stunts not found" ]]
  [[ "$output" =~ "Clone git-stunts?" ]]
  [[ "$output" =~ "Setup cancelled" ]]
}

@test "setup clones git-stunts if user accepts" {
  mock_docker_working
  mock_git_clone_success

  # Simulate user accepting (send 'y' to stdin)
  run bash scripts/setup.sh <<< "y"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Cloning git-stunts" ]]
  [[ "$output" =~ "Setup complete" ]]
  [ -d "$TEST_DIR/git-stunts" ]
}

@test "setup fails gracefully if git clone fails" {
  mock_docker_working
  mock_git_clone_fail

  # Simulate user accepting (send 'y' to stdin)
  run bash scripts/setup.sh <<< "y"
  [ "$status" -eq 1 ]
  [[ "$output" =~ "Failed to clone git-stunts" ]]
  [[ "$output" =~ "Please clone manually" ]]
}

@test "setup shows helpful next steps after success" {
  mock_docker_working

  # Create git-stunts
  mkdir -p "$TEST_DIR/git-stunts"

  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  [[ "$output" =~ "npm run demo" ]]
  [[ "$output" =~ "npm run quickstart" ]]
  [[ "$output" =~ "npm run dev" ]]
}
