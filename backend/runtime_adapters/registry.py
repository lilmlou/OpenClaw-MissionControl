from .hermes import HermesRuntimeAdapter
from .openclaw import OpenClawRuntimeAdapter

_RUNTIME_REGISTRY = {
    "openclaw": OpenClawRuntimeAdapter(),
    "hermes": HermesRuntimeAdapter(),
}


def get_runtime_adapter(runtime: str):
    return _RUNTIME_REGISTRY.get(runtime, _RUNTIME_REGISTRY["openclaw"])
