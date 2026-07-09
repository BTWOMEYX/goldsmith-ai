from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\index.css")
text = path.read_text()

addition = r'''

/* GoldSmith global UI polish */
:root {
  color-scheme: dark;
}

* {
  scrollbar-width: thin;
  scrollbar-color: #334155 #020617;
}

*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

*::-webkit-scrollbar-track {
  background: #020617;
  border-radius: 999px;
}

*::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 999px;
  border: 2px solid #020617;
}

*::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

html[data-goldsmith-mode="simple"] .pro-only {
  display: none !important;
}

.goldsmith-soft-card {
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(51, 65, 85, 0.75);
}

.goldsmith-action-glow {
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.35), 0 20px 60px rgba(245, 158, 11, 0.08);
}
'''

if "GoldSmith global UI polish" not in text:
    text += addition

path.write_text(text)
print("index.css patched with GoldSmith global UI polish.")
