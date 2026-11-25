window.ROLE_MODULES = [
  {
    "id": "python",
    "title": "Python for reliable tests",
    "tag": "Python",
    "analogy": "Like labelled sample containers: each test owns its data. Aliasing the same mutable dictionary makes tests contaminate one another.",
    "body": "Use small functions, explicit inputs, exceptions and context managers. Know list/dict/set, shallow copies, generators, equality versus identity, and default mutable arguments. Validate before changing state; never swallow exceptions just to make a test green.",
    "code": "def configure(value):\n    if isinstance(value, bool) or not isinstance(value, int):\n        raise TypeError(\"integer required\")\n    if not 0 <= value <= 100:\n        raise ValueError(\"out of range\")\n    return {\"threshold\": value}\n",
    "question": "Which input needs special attention when validating an integer?",
    "options": [
      "True, because bool is a subclass of int",
      "Only 50",
      "Only None"
    ],
    "answer": 0,
    "practice": "Write configure() and test -1, 0, 100, 101, True and \"10\". Explain TypeError versus ValueError. Run your tests locally.",
    "guide": "Assert valid dictionaries for 0 and 100; use pytest.raises(ValueError) for -1/101 and pytest.raises(TypeError) for True/\"10\". Invalid input must not mutate an existing configuration.",
    "url": "https://docs.python.org/3/tutorial/errors.html"
  },
  {
    "id": "design",
    "title": "Turn requirements into tests",
    "tag": "Test design",
    "analogy": "A thermostat specification is a rule book. Test the edges of each rule before collecting random examples.",
    "body": "Clarify units, inclusive boundaries, defaults, failure behavior and observability. Use equivalence partitions, boundary values, decision tables and state transitions. Trace each case to a requirement; record ambiguities instead of inventing acceptance criteria.",
    "code": "R-01: threshold is an integer in [0, 100].\nR-02: alert is true only when sample > threshold.\nR-03: rejected configuration preserves the old threshold.\nCases: -1, 0, 1, 99, 100, 101; sample t-1, t, t+1.\n",
    "question": "For alert = sample > 50, what happens at sample 50?",
    "options": [
      "Alert on",
      "Alert off",
      "The requirement is missing"
    ],
    "answer": 1,
    "practice": "Build a table with requirement ID, precondition, input, expected output and priority. Include invalid type and state preservation cases.",
    "guide": "For R-02: threshold 50, samples 49/50/51 expect false/false/true. For R-03: configure 50, reject 101, then sample 51 must still alert. Ask what happens to NaN or missing samples.",
    "url": "https://www.istqb.org/certifications/certified-tester-foundation-level"
  },
  {
    "id": "pytest",
    "title": "Pytest: assertions and parametrization",
    "tag": "Pytest",
    "analogy": "One test recipe, many labelled ingredients: parametrization repeats a behavior check with different cases.",
    "body": "Write arrange–act–assert tests. Use pytest.raises for documented errors and parametrize with readable IDs. Assert externally observable behavior, not private implementation. A test returning False does not fail: use assert. Know discovery rules and -k, -m, -x, -vv.",
    "code": "import pytest\n\n@pytest.mark.parametrize(\"sample, expected\", [(49, False), (50, False), (51, True)], ids=[\"below\", \"equal\", \"above\"])\ndef test_alert(sample, expected):\n    assert (sample > 50) is expected\n",
    "question": "How does Pytest recognize a failed expectation?",
    "options": [
      "Return False",
      "print(\"failed\")",
      "An assertion or unexpected exception"
    ],
    "answer": 2,
    "practice": "Write boundary tests with IDs R02-below, R02-equal and R02-above. Deliberately break > into >= and confirm the equal case fails.",
    "guide": "Run python -m pytest -vv. The equal case is a regression test for the inclusive-boundary bug. Keep it after fixing the component.",
    "url": "https://docs.pytest.org/en/stable/how-to/parametrize.html"
  },
  {
    "id": "fixtures",
    "title": "Fixtures, isolation and test doubles",
    "tag": "Pytest",
    "analogy": "Each lab experiment gets a clean workbench; yield is the cleanup checklist after the experiment.",
    "body": "Default function scope isolates mutable state. Use yield/finally cleanup for processes and connections, tmp_path for files, monkeypatch at the lookup location, caplog for log assertions. Mock network/time at the boundary; keep integration tests for the real boundary.",
    "code": "import pytest\n\n@pytest.fixture\ndef config_file(tmp_path):\n    file = tmp_path / \"config.txt\"\n    file.write_text(\"50\", encoding=\"utf-8\")\n    return file\n\ndef test_config(config_file):\n    assert config_file.read_text() == \"50\"\n",
    "question": "Which fixture scope is safest for mutable per-test component state?",
    "options": [
      "session",
      "function",
      "All scopes are identical"
    ],
    "answer": 1,
    "practice": "Create a fixture that starts a subprocess, yields it and terminates it in finally. Force an assertion failure and verify cleanup still runs.",
    "guide": "Use try/finally around yield; terminate, then wait(timeout=...), and kill if termination times out. Do not reuse one mutable service across all tests without resetting it.",
    "url": "https://docs.pytest.org/en/stable/how-to/fixtures.html"
  },
  {
    "id": "cpp",
    "title": "Read and configure a C++ component",
    "tag": "C++ basics",
    "analogy": "Python is the test operator; the compiled C++ component is the instrument under test.",
    "body": "Understand headers, source files, compilation/linking, main(), return codes, references, const, constructors and RAII. Learn enough to configure/build the service and interpret errors. Do not claim advanced C++ ownership expertise before practising it. Prefer a supported CLI/API binding over reaching into private internals.",
    "code": "// threshold.cpp\n#include <iostream>\nint main() {\n    const int threshold = 50;\n    int sample;\n    if (!(std::cin >> sample)) return 2;\n    std::cout << (sample > threshold ? \"ALERT\" : \"OK\");\n}\n// g++ -std=c++17 threshold.cpp -o threshold\n",
    "question": "What does RAII primarily help with?",
    "options": [
      "Automatic resource cleanup through object lifetime",
      "Making Python fixtures session-scoped",
      "MQTT delivery guarantees"
    ],
    "answer": 0,
    "practice": "Compile the example. Feed 49, 50, 51 and invalid text. Add configurable threshold validation. Test non-zero exit codes from Python.",
    "guide": "Use subprocess.run([...], input=\"51\", text=True, capture_output=True, timeout=2). Assert returncode and stdout separately. Distinguish compile failure from a component assertion failure.",
    "url": "https://en.cppreference.com/w/cpp/language/raii.html"
  },
  {
    "id": "component",
    "title": "Build a component-test framework",
    "tag": "Framework",
    "analogy": "A reusable adapter translates test language into the component protocol, like a universal remote with clear buttons.",
    "body": "Separate tests, component adapter, fixtures, configuration and reporting. Keep domain assertions in tests. Use subprocess argument lists, bounded timeouts and captured stdout/stderr. A timeout is evidence of a problem, not an empty successful response. The downloadable project below exercises a real compiled component.",
    "code": "project/\n  component.cpp\n  test_component.py  # requirement-linked cases\n  requirements.txt\n  azure-pipelines.yml\n  README.md\n\npython -m pytest -v --junitxml=results.xml\n",
    "question": "Where should process launch and transport details live?",
    "options": [
      "Copied into every test",
      "In a reusable adapter/fixture",
      "Inside every assertion message"
    ],
    "answer": 1,
    "practice": "Download the practice project. Run it, introduce a boundary defect, collect the failing JUnit report and fix the defect.",
    "guide": "Explain the contract, isolation, teardown, diagnostics and reporting. Separate fast component tests from optional real-broker integration tests. A folder structure alone is not a framework.",
    "url": "https://docs.python.org/3/library/subprocess.html"
  },
  {
    "id": "mqtt",
    "title": "MQTT: messages, duplicates and state",
    "tag": "MQTT",
    "analogy": "A broker is a post office: topic names are addresses. A receipt does not prove your application performed an action exactly once.",
    "body": "Know publisher/subscriber, broker, topic filters, QoS 0/1/2, retained messages, sessions, last will and reconnects. QoS 1 allows duplicates. QoS 2 avoids duplicates within its protocol exchange, not every end-to-end business side effect. Correlate responses; make commands idempotent where required. Establish subscription readiness before publishing.",
    "code": "command: {\"id\":\"cmd-7\", \"threshold\":50}\nstatus:  {\"id\":\"cmd-7\", \"accepted\":true}\n\nTest: deliver cmd-7 twice.\nExpected: one state change if the service contract requires idempotency.\nAlso test invalid JSON, wrong topic, retained old state and reconnect.\n",
    "question": "What must a QoS 1 consumer tolerate?",
    "options": [
      "No messages ever lost under every outage",
      "Duplicate deliveries",
      "Automatic business-level deduplication"
    ],
    "answer": 1,
    "practice": "Use the delivery game below. Then write a broker integration test plan: unique topic prefix, subscribe acknowledgment, correlation ID, deadline and cleanup.",
    "guide": "Use a monotonic deadline and event/queue wait with a timeout. Filter unrelated responses by correlation ID. Reset retained data you created. Do not replace readiness checks with arbitrary sleep().",
    "url": "https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html"
  },
  {
    "id": "async",
    "title": "Deterministic asynchronous tests",
    "tag": "Reliability",
    "analogy": "Wait for the doorbell with a deadline; do not assume the visitor arrived after an arbitrary nap.",
    "body": "Test asynchronous events with bounded condition waits, correlation IDs and diagnostics on timeout. Inject a clock for unit tests of retries/backoff. Test disconnect, retry exhaustion, malformed payload and out-of-order responses. Rerunning failed tests can reveal flakiness but does not repair it.",
    "code": "from queue import Queue, Empty\nresponses = Queue()\n# callback pushes only the expected correlation ID\ntry:\n    message = responses.get(timeout=2)\nexcept Empty:\n    raise AssertionError(\"No matching status within 2 seconds\")\n",
    "question": "What is better than sleep(10) before asserting?",
    "options": [
      "sleep(30)",
      "Retry forever",
      "A bounded wait for the expected condition"
    ],
    "answer": 2,
    "practice": "Write a fake transport that delivers unrelated and matching IDs. Assert only the matching message completes the request, and a missing response times out.",
    "guide": "Use deterministic injected events in unit tests. Real broker tests still need bounded waits and useful diagnostics: topic, ID, connection status and recent messages.",
    "url": "https://docs.python.org/3/library/queue.html"
  },
  {
    "id": "git",
    "title": "Git and VS Code workflow",
    "tag": "Git · VS Code",
    "analogy": "A small reviewed branch is a labelled experiment you can reproduce or undo.",
    "body": "Know clone, status, diff, add, commit, branch, pull, merge and conflict resolution. Review a staged diff before committing. Never commit credentials or private logs. In VS Code select the correct Python interpreter, use the testing panel and debug one failed test before the whole suite.",
    "code": "git switch -c test/threshold-boundaries\ngit diff\npython -m pytest -k equal -vv\ngit add test_component.py\ngit diff --staged\ngit commit -m \"Test threshold boundary requirement R-02\"\n",
    "question": "After resolving a merge conflict, what comes next?",
    "options": [
      "Commit immediately without review",
      "Review the combined behavior and rerun relevant tests",
      "Delete every conflicting test"
    ],
    "answer": 1,
    "practice": "Make a branch, add a test and resolve a small intentional conflict in a practice repository. Explain merge versus rebase without rewriting shared history.",
    "guide": "A useful PR explains requirement, behavior tested, execution evidence and remaining gaps. Configure pytest discovery in VS Code and set a breakpoint in the failing adapter.",
    "url": "https://code.visualstudio.com/docs/python/testing"
  },
  {
    "id": "docker",
    "title": "Docker development and broker isolation",
    "tag": "Docker",
    "analogy": "A container packages the workbench; its network and filesystem are still separate rooms you must connect deliberately.",
    "body": "Know image versus container, Dockerfile layers, bind mounts, environment variables and exit codes. localhost inside a container refers to that container. On a Compose network use service names. Pin dependencies, keep secrets out of images and wait for readiness. Containerization does not prove a test is deterministic.",
    "code": "# From the downloaded practice project\ndocker build -t component-practice .\ndocker run --rm component-practice\n\n# For a separate MQTT lab, pin a Mosquitto image,\n# bind broker ports to loopback and use a dedicated test network.\n",
    "question": "From a test container, how should you address a broker service in Compose?",
    "options": [
      "Always localhost",
      "The broker service name",
      "The Python file name"
    ],
    "answer": 1,
    "practice": "Run the downloaded tests in Docker. Explain the build stage, working directory, test exit code and how to export results with a bind mount.",
    "guide": "Use a pinned base image for reproducibility in real CI, install compiler and pinned pytest, then run tests. Mount /app/results to a host directory when retaining JUnit output.",
    "url": "https://docs.docker.com/compose/how-tos/networking/"
  },
  {
    "id": "ado",
    "title": "Azure DevOps: visible failures",
    "tag": "CI/CD",
    "analogy": "A CI pipeline is a repeatable inspection station. A red station must still leave a readable inspection report.",
    "body": "Checkout, select Python, install dependencies, build the component and run pytest. Publish JUnit results even when tests fail. Preserve the failing process exit code; never use || true to hide it. Publish useful logs/artifacts and protect secrets. Distinguish product defects, environment failures and test defects.",
    "code": "- script: python -m pytest --junitxml=results/pytest.xml\n  displayName: Run component tests\n- task: PublishTestResults@2\n  condition: succeededOrFailed()\n  inputs:\n    testResultsFormat: JUnit\n    testResultsFiles: results/pytest.xml\n    failTaskOnFailedTests: true\n",
    "question": "Why publish results with succeededOrFailed()?",
    "options": [
      "To hide failure",
      "To retain test evidence when the test step fails",
      "To skip broken tests"
    ],
    "answer": 1,
    "practice": "Read the included Azure pipeline. Describe what happens when compilation fails versus when one test assertion fails. Do not claim you ran ADO without actually running it.",
    "guide": "Compilation errors should be explicit diagnostics; assertion failures create JUnit. Missing reports should also be visible. Run fast tests on each PR and separately schedule slower integration suites.",
    "url": "https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/publish-test-results-v2?view=azure-pipelines"
  },
  {
    "id": "trace",
    "title": "Polarion, Jira and defect investigation",
    "tag": "Traceability",
    "analogy": "Every failed experiment needs a trail back to the rule it checked and the exact instrument version.",
    "body": "Connect requirement → test case → test run → defect. Polarion project fields and import mappings vary: learn your team’s template. Jira/ADO defects need build, environment, preconditions, steps, expected/actual, evidence and severity rationale. Redact sensitive information. Retest fixes and run adjacent regression cases.",
    "code": "Requirement: R-02 sample equal to threshold does not alert\nTest: test_threshold[R02-equal]\nBuild: commit SHA + compiler + Python/pytest versions\nExpected: OK; Actual: ALERT\nEvidence: sanitized stdout, command and JUnit case\nImpact: false alert at exact configured threshold\n",
    "question": "What is the most useful defect report?",
    "options": [
      "\"Not working\"",
      "Only a screenshot",
      "Reproducible steps, expected/actual, build and evidence"
    ],
    "answer": 2,
    "practice": "Create one defect for the intentional >= bug. Link its requirement and test, write a retest note and identify two adjacent regression cases.",
    "guide": "Use a concise title: \"R-02: sample equal to threshold incorrectly raises alert\". Record actual evidence; don’t invent severity or root cause before investigating.",
    "url": "https://polarion.plm.automation.siemens.com/products/polarion-qa"
  }
];
