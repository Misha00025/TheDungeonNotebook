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
