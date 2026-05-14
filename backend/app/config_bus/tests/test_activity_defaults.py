from app.config_bus.defaults import list_day_one_keys, register_day_one
from app.config_bus.bus import bus


def test_activities_feed_max_items_registered():
    register_day_one()
    doc = bus.get_doc("activities.feed.max_items")

    assert doc["value"] == 50
    assert doc["schema"]["type"] == "integer"
    assert doc["schema"]["minimum"] == 10
    assert doc["schema"]["maximum"] == 500
    assert "activities.feed.max_items" in list_day_one_keys()
