from datetime import datetime

from server import Conversation, ConversationCreate


def test_conversation_defaults_runtime_to_openclaw():
    conversation = Conversation()
    assert conversation.runtime == "openclaw"


def test_conversation_create_accepts_runtime_override():
    payload = ConversationCreate(title="Hermes chat", runtime="hermes")
    assert payload.runtime == "hermes"


def test_conversation_model_dump_contains_runtime_field():
    conversation = Conversation(title="Runtime thread", runtime="hermes")
    dumped = conversation.model_dump()
    assert dumped["runtime"] == "hermes"
    assert isinstance(conversation.created_at, datetime)
