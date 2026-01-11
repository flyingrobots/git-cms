# Dockerfile for running BATS tests
FROM bats/bats:latest

# Install additional tools needed for testing
RUN apk add --no-cache bash git

WORKDIR /code

# Copy test files
COPY test/setup.bats /code/test/setup.bats
COPY scripts/setup.sh /code/scripts/setup.sh
COPY package.json /code/package.json

# Run BATS tests
CMD ["/code/test/setup.bats"]
