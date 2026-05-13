from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.brain_config import ROUTER_CONFIG_KEYS, register_brain_config_keys
from app.config_bus.bus import bus
from app.config_bus.routes import config_router


def test_router_config_defaults_registered_with_hot_reload_schema():
    bus._reset_for_tests()
    register_brain_config_keys()
    docs = [bus.get_doc(key) for key in ROUTER_CONFIG_KEYS]
    assert len(docs) == 12
    assert {doc['_id'] for doc in docs} == set(ROUTER_CONFIG_KEYS)
    for doc in docs:
        schema = doc.get('schema') or {}
        assert schema.get('category') == 'router'
        assert schema.get('x-mission-control', {}).get('hot_reload') is True
        assert schema.get('x-mission-control', {}).get('visible') is True
        assert schema.get('x-mission-control', {}).get('surface') == 'model-router'


def test_router_config_list_filter_returns_router_prefix_docs():
    bus._reset_for_tests()
    register_brain_config_keys()
    docs = [doc for doc in bus.list_docs() if doc['_id'].startswith('router.')]
    assert len(docs) == 12


def test_config_http_prefix_filter_returns_router_docs_in_contract_shape():
    bus._reset_for_tests()
    register_brain_config_keys()
    app = FastAPI()
    app.include_router(config_router)
    with TestClient(app) as client:
        body = client.get('/api/v2/config?prefix=router.').json()
    assert body['ok'] is True
    assert body['total'] == 12
    assert body['data']['total'] == 12
    assert len(body['data']['items']) == 12
    assert all(item['_id'].startswith('router.') for item in body['data']['items'])
