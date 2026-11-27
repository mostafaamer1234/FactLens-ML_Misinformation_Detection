from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from text_cleaning import strip_artifacts  # noqa: E402

ARTICLE = (
    "The city council approved a new budget on Tuesday that increases funding for public transit "
    "and road repairs, officials said, after months of negotiations with state lawmakers."
)


def test_reuters_dateline_and_mentions_are_removed():
    out = strip_artifacts("WASHINGTON (Reuters) - Lawmakers met on Tuesday, Reuters reported.")
    assert "reuters" not in out.lower() and out.startswith("Lawmakers")


def test_outlet_boilerplate_urls_and_handles_are_removed():
    out = strip_artifacts("Big news today @someuser https://t.co/abc pic.twitter.com/xyz Featured image via Getty Images")
    assert out == "Big news today"


def test_prediction_cannot_be_flipped_by_adding_a_reuters_dateline():
    import webapp.app as app_module

    plain = app_module.clf.predict_proba([strip_artifacts(ARTICLE)])[0]
    with_dateline = app_module.clf.predict_proba([strip_artifacts("NEW YORK (Reuters) - " + ARTICLE)])[0]
    assert (plain == with_dateline).all()


def test_analyze_endpoint_returns_label_and_cluster():
    import webapp.app as app_module

    client = app_module.app.test_client()
    resp = client.post("/analyze", data={"article_text": ARTICLE})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["label"] in {"REAL", "FAKE"}
    assert abs(body["fake_probability"] + body["real_probability"] - 1) < 1e-6
    assert isinstance(body["cluster_id"], int)


def test_empty_input_is_rejected():
    import webapp.app as app_module

    resp = app_module.app.test_client().post("/analyze", data={"article_text": "   "})
    assert resp.status_code == 400
