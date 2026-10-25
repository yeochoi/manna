# Stamps a new version on the app's CSS and JS links so phones load the latest files.
# Run before every push: python3 scripts/bump-version.py
import re, time, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / "index.html"
v = time.strftime("%Y%m%d%H%M")
s = p.read_text(encoding="utf-8")
s = re.sub(r'(href|src)="(styles\.css|i18n\.js|summary\.js|app\.js)(\?v=\w+)?"', lambda m: f'{m.group(1)}="{m.group(2)}?v={v}"', s)
p.write_text(s, encoding="utf-8")
print("version", v)
