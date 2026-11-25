"""How much of the 99% F1 comes from source artifacts rather than content?

The ISOT / Kaggle "Fake and real news" dataset has a well-known shortcut: almost
every REAL article comes from Reuters and starts with a dateline such as
"WASHINGTON (Reuters) -", while FAKE articles come from other outlets with their
own boilerplate ("Featured image via ...", Twitter embeds, "21st Century Wire").
A model can score near-perfectly by spotting the publisher instead of judging
the claim. This script measures that effect:

  1. Original setup        TF-IDF + logistic regression on raw title + text
  2. Shortcut only         a single rule: does the text contain "(Reuters)"?
  3. Cues removed          the same model after stripping publisher artifacts
  4. Cross-dataset         the cues-removed model applied to LIAR (PolitiFact statements)

    python analysis/leakage_study.py                       # steps 1-3
    python analysis/leakage_study.py --liar path/to/liar   # adds step 4 (folder with train.tsv/test.tsv)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score as _f1


def f1_score(y_true, y_pred) -> float:
    """Macro-F1: averages FAKE and REAL so always guessing one class scores poorly."""
    return _f1(y_true, y_pred, average="macro")
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from text_cleaning import strip_artifacts  # noqa: E402

SEED = 42

def load_isot(data_dir: Path = ROOT / "data") -> pd.DataFrame:
    fake = pd.read_csv(data_dir / "Fake.csv").assign(label=1)
    true = pd.read_csv(data_dir / "True.csv").assign(label=0)
    df = pd.concat([fake, true], ignore_index=True)[["title", "text", "label"]].fillna("")
    df["raw"] = df["title"] + " " + df["text"]
    df["clean"] = (df["title"] + " " + df["text"]).map(strip_artifacts)
    # drop exact duplicates so the same article cannot sit on both sides of the split
    return df.drop_duplicates(subset="clean").reset_index(drop=True)


def model() -> object:
    return make_pipeline(
        TfidfVectorizer(max_features=10000, ngram_range=(1, 2), sublinear_tf=True, stop_words="english"),
        LogisticRegression(max_iter=2000, C=4.0),
    )


def load_liar(folder: Path) -> pd.DataFrame:
    cols = ["id", "label", "statement", "subject", "speaker", "job", "state", "party", "c1", "c2", "c3", "c4", "c5", "context"]
    df = pd.concat([pd.read_csv(folder / f, sep="\t", header=None, names=cols) for f in ("train.tsv", "test.tsv")])
    fake = {"pants-fire", "false", "barely-true"}
    real = {"true", "mostly-true"}
    df = df[df["label"].isin(fake | real)]  # drop the ambiguous "half-true" middle class
    return pd.DataFrame({"clean": df["statement"].map(strip_artifacts), "label": df["label"].isin(fake).astype(int)})


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--liar", type=Path, help="folder containing LIAR train.tsv and test.tsv")
    args = ap.parse_args()

    df = load_isot()
    train, test = train_test_split(df, test_size=0.2, random_state=SEED, stratify=df["label"])
    rows = []

    m_raw = model().fit(train["raw"], train["label"])
    rows.append(("Original: TF-IDF + LR on raw text", f1_score(test["label"], m_raw.predict(test["raw"]))))

    rule = (~test["raw"].str.contains(r"\(Reuters\)", case=False, regex=True)).astype(int)
    rows.append(('Shortcut: "no (Reuters) in text" means fake', f1_score(test["label"], rule)))

    m_clean = model().fit(train["clean"], train["label"])
    rows.append(("Same model, publisher cues removed", f1_score(test["label"], m_clean.predict(test["clean"]))))

    if args.liar:
        liar = load_liar(args.liar)
        rows.append((f"Cues-removed model on LIAR statements (n={len(liar)})", f1_score(liar["label"], m_clean.predict(liar["clean"]))))
        rows.append(("Trivial baseline on LIAR: always predict fake", f1_score(liar["label"], np.ones(len(liar), dtype=int))))
        m_liar = model()
        ltr, lte = train_test_split(liar, test_size=0.2, random_state=SEED, stratify=liar["label"])
        m_liar.fit(ltr["clean"], ltr["label"])
        rows.append(("Reference: same model trained and tested on LIAR", f1_score(lte["label"], m_liar.predict(lte["clean"]))))

    print(f"ISOT articles after de-duplication: {len(df)} (test split: {len(test)}), macro-F1\n")
    print("| Setup | Macro-F1 |\n|---|---|")
    for name, f1 in rows:
        print(f"| {name} | {f1:.3f} |")

    vocab = np.array(m_raw[0].get_feature_names_out())
    coefs = m_raw[1].coef_[0]
    print("\nStrongest 'real' features in the original model:", ", ".join(vocab[np.argsort(coefs)[:8]]))


if __name__ == "__main__":
    main()
