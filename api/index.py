"""Vercel entry point: serve the FactLens Flask app as a Python function."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from webapp.app import app  # noqa: E402,F401  (Vercel looks for a WSGI `app`)
