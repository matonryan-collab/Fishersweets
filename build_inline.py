#!/usr/bin/env python3
"""Inline styles.css, script.js, and the asset images into a single self-contained index.html.
Run:  python3 build_inline.py
Sources of truth: index.src.html + styles.css + script.js + assets/*
Output: index.html (fully self-contained, works on double-click / any host)
"""
import base64, pathlib, re, sys

root = pathlib.Path(__file__).parent
src = (root / "index.src.html").read_text()
css = (root / "styles.css").read_text()
js  = (root / "script.js").read_text()

def data_uri(rel):
    p = root / rel
    b = base64.b64encode(p.read_bytes()).decode()
    return f"data:image/jpeg;base64,{b}"

# inline stylesheet
src = src.replace(
    '<link rel="stylesheet" href="styles.css" />',
    "<style>\n" + css + "\n</style>")

# inline script
src = src.replace(
    '<script src="script.js"></script>',
    "<script>\n" + js + "\n</script>")

# inline images referenced as src="assets/..." (NOT the og:image meta — crawlers
# need a real hosted URL, so that one stays a path).
for rel in sorted(set(re.findall(r'src="(assets/[\w.-]+)"', src))):
    if not (root / rel).exists():
        continue  # e.g. the "assets/yourphoto.jpg" placeholder inside a comment
    src = src.replace(f'src="{rel}"', f'src="{data_uri(rel)}"')

out = root / "index.html"
out.write_text(src)
print(f"Wrote {out} ({out.stat().st_size//1024} KB, self-contained)")
