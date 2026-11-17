#!/usr/bin/env python3
"""Create dist/cosmic-crafting-solver.zip with only the end-user files."""
import os
import zipfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DIST = os.path.join(ROOT, "dist")
FILES = ["cosmic-sinus-ardorum.html", "cosmic-phaenna.html", "cosmic-oizys.html", "cosmic-auxesia.html"]
out = os.path.join(DIST, "cosmic-crafting-solver.zip")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in FILES:
        z.write(os.path.join(DIST, name), name)
    z.write(os.path.join(ROOT, "docs", "USER_README.md"), "README.md")
with zipfile.ZipFile(out) as z:
    print(out, [i.filename for i in z.infolist()], os.path.getsize(out), "bytes")
