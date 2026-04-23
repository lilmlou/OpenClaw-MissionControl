from runtime_adapters.registry import get_runtime_adapter
from runtime_adapters.openclaw import OpenClawRuntimeAdapter
from runtime_adapters.hermes import HermesRuntimeAdapter


def test_registry_returns_openclaw_adapter_for_openclaw_runtime():
    adapter = get_runtime_adapter("openclaw")
    assert isinstance(adapter, OpenClawRuntimeAdapter)
    assert adapter.runtime_name == "openclaw"


def test_registry_returns_hermes_adapter_for_hermes_runtime():
    adapter = get_runtime_adapter("hermes")
    assert isinstance(adapter, HermesRuntimeAdapter)
    assert adapter.runtime_name == "hermes"


def test_registry_falls_back_to_openclaw_for_unknown_runtime():
    adapter = get_runtime_adapter("unknown")
    assert isinstance(adapter, OpenClawRuntimeAdapter)
    assert adapter.runtime_name == "openclaw"
