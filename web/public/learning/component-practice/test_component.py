"""Real subprocess component checks; no live MQTT broker is involved."""
from pathlib import Path
import subprocess
import pytest

@pytest.fixture(scope="session")
def component(tmp_path_factory):
    binary = tmp_path_factory.mktemp("build") / "component"
    result = subprocess.run(["g++", "-std=c++17", "-Wall", "-Wextra", str(Path(__file__).with_name("component.cpp")), "-o", str(binary)], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    return binary

def run(component, threshold, sample):
    return subprocess.run([str(component), str(threshold), str(sample)], capture_output=True, text=True, timeout=2)

@pytest.mark.parametrize("sample,expected", [(49,"OK"),(50,"OK"),(51,"ALERT")], ids=["R02-below","R02-equal","R02-above"])
def test_boundary(component, sample, expected):
    result = run(component,50,sample)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == expected

@pytest.mark.parametrize("threshold", [-1,101,"true","10x","",999999999999999999], ids=["R01-low","R01-high","R01-type","R01-suffix","R01-empty","R01-overflow"])
def test_invalid_configuration(component,threshold):
    result = run(component,threshold,51)
    assert result.returncode == 2
    assert result.stderr.strip()
    assert not result.stdout

@pytest.mark.parametrize("threshold", [0,100], ids=["R01-min","R01-max"])
def test_valid_configuration(component,threshold):
    result = run(component,threshold,threshold)
    assert result.returncode == 0
    assert result.stdout.strip() == "OK"

def test_missing_arguments(component):
    result = subprocess.run([str(component)],capture_output=True,text=True,timeout=2)
    assert result.returncode == 2
    assert "usage" in result.stderr
