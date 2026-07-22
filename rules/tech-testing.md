# Integration Testing Conventions

## Test Framework
- Custom Python framework (not pytest-style assertions)
- Location: `backend/api-gateway/tests/`
- Entry point: `test.py` with argparse (`-c` compact, `-d` debug, `--server`, `-S` scenario filter)

## Test Structure
```
tests/
├── test.py                    # Main runner, scenario registration
├── test.sh                    # Shell launcher
├── docker-compose.yaml        # Test-specific Docker stack
├── .env                       # Test environment vars
├── certs/                     # Test RSA keys
├── scenarios/                 # Test scenarios (one file per feature)
└── tests/                     # Framework internals
```

## Test Execution
```bash
cd backend/api-gateway/tests
./test.sh 15                     # Wait 15s, run all tests
./test.sh 15 -S GatewayMain      # Run only GatewayMain scenario
./venv/bin/python test.py        # Direct run (requires running stack)
```
10 seconds is optimal time.


## test.sh Flow
1. Clean mongo_data/ and mysql_data/
2. `docker-compose build && docker-compose up -d`
3. Wait until container is running + additional sleep (first arg)
4. Run tests via `./venv/bin/python test.py`
5. Collect logs into `logs/`
6. Print summary (request count, status distribution, errors, 501s)

## Adding a New Scenario
1. Create `scenarios/<feature>.py`
2. Define `register_<feature>()` function that adds test cases to global `scenarios` list
3. In `test.py`: import and call the register function
4. Add scenario name to argparse help and the if-elif chain

## CI/CD Integration

GitHub Actions workflow: `.github/workflows/tests.yml`
CI script: `backend/api-gateway/tests/test-ci.sh`

### Trigger
- Pull request to `main` branch

### How it works
1. Checkout code
2. Setup Python 3.13
3. Run `test-ci.sh` which:
   - Installs Python dependencies
   - Builds and starts all services via Docker Compose
   - Waits for api-gateway readiness
   - Runs all test scenarios
   - Prints summary and last gateway logs
   - Stops all containers
4. On failure: uploads test logs as a GitHub Actions artifact

### Local vs CI
- **Local:** `./test.sh 15` — uses venv, sudo rm, colored summary
- **CI:** `bash test-ci.sh` — no sudo, no venv, stdout output, exit code
