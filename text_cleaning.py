"""Remove publisher artifacts that let a classifier identify the outlet instead of judging the content.

In the ISOT / Kaggle fake-news data, REAL articles almost all carry a Reuters dateline
("WASHINGTON (Reuters) -") and FAKE articles carry other outlets' boilerplate. A rule that
only checks for "(Reuters)" scores 0.995 macro-F1 (see analysis/leakage_study.py), so these
cues are stripped before training and before every prediction.
"""

from __future__ import annotations

import re

ARTIFACT_PATTERNS = [
    r"^.{0,120}?\(reuters\)\s*-\s*",  # "WASHINGTON (Reuters) - " dateline
    r"\breuters\b",
    r"featured image (via|by|credit)[^.\n]*",
    r"photo by [^.\n]*",
    r"image (via|credit)[^.\n]*",
    r"21st century wire",
    r"pic\.twitter\.com/\S+",
    r"https?://\S+",
    r"@\w+",
    r"getty images",
    r"\bvia\s+(youtube|twitter|facebook)\b",
]
_ARTIFACTS = re.compile("|".join(f"(?:{p})" for p in ARTIFACT_PATTERNS), re.IGNORECASE | re.MULTILINE)


def strip_artifacts(text: str) -> str:
    return re.sub(r"\s+", " ", _ARTIFACTS.sub(" ", str(text))).strip()
