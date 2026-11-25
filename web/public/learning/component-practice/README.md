# Service component interview practice

This small real C++ executable is tested by Python/Pytest. It is not a production framework or a real MQTT integration. It covers stateless R-01/R-02; state preservation R-03 is a follow-up extension, not something this executable implements.

## Run locally
Install Python 3.10+ and g++ (Linux, macOS with a compatible compiler, or Windows WSL). In VS Code select this folder and your virtual environment interpreter.

    python3 -m venv .venv
    . .venv/bin/activate
    python -m pip install -r requirements.txt
    python -m pytest -vv --junitxml=results/pytest.xml

On macOS install a compatible C++ compiler; replace g++ in the fixture if needed. Windows users can run these exact commands in WSL. The fixture compiles to a temporary directory, then tests invoke a fresh process each time. No customer data, network or secrets are required.

## Requirements and coverage
R-01: threshold is an integer in inclusive range 0..100. Invalid values exit 2 with stderr; no normal output. Input is a CLI string; textual true is invalid.
R-02: ALERT only when sample > threshold; equality returns OK.
R-04: wrong argument count exits 2 with usage guidance.
Tests use requirement-linked parametrization IDs. Numeric parsing follows std::stoi (leading whitespace/+ accepted). Clarify that contract before tightening it.

## Learn by introducing a bug
1. Run the clean suite: all 12 cases should pass.
2. Change sample > threshold into sample >= threshold in component.cpp.
3. Run pytest again. R02-equal and equality checks at min/max fail.
4. Inspect stdout, assertion diff and results/pytest.xml. Write a defect with build, reproduction, expected/actual and requirement link.
5. Restore > and rerun; keep the regression tests.

## Build a framework one step at a time
1. Extract run() into an adapter with structured results; keep assertions in tests.
2. Add a stateful component interface and R-03: failed configuration preserves the previous threshold. Write a failing test before implementation.
3. Add a fake transport and a deduplication contract. This is a unit simulation, not broker integration.
4. Add optional real Mosquitto integration in a separate suite: unique topics, subscribe acknowledgment, correlation IDs, bounded waits and cleanup of retained messages. Test reconnect/QoS behavior; do not infer it from mocks.
5. Add reporting and requirement-to-test mapping using your team's Polarion fields; the sample does not connect to Polarion or Jira.

## Docker and Azure DevOps
    docker build -t component-practice .
    docker run --rm -v "$PWD/results:/app/results" component-practice

The Dockerfile is a learning starting point: pin image digests and dependencies for your production reproducibility policy. Azure's hosted Ubuntu image provides g++; verify compiler availability for your chosen agent. Copy the pipeline into a practice Azure repository, enable a pipeline and inspect the failed run after introducing the bug. The publishing step retains results even after test failure. These templates are examples, not evidence that you have deployed them.

## Explain in an interview
Why component tests instead of UI tests? What does the fixture isolate? Why subprocess timeout? What if compilation fails? Why separate stderr, exit code and stdout? Which requirements are NOT covered? How would you add a real broker without making tests flaky?

Use your real healthcare automation examples for experience questions. Do not present this practice project as commercial C++/MQTT work.
