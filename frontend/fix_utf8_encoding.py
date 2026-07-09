from pathlib import Path

root = Path(r"F:\Projects\goldsmith-ai\frontend\src")
extensions = {".ts", ".tsx", ".css"}

converted = []

for path in root.rglob("*"):
    if path.suffix.lower() not in extensions:
        continue

    data = path.read_bytes()

    try:
        data.decode("utf-8")
        continue
    except UnicodeDecodeError:
        pass

    text = None

    for encoding in ["utf-16", "utf-16-le", "cp1252"]:
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if text is None:
        print(f"Could not decode: {path}")
        continue

    path.write_text(text, encoding="utf-8", newline="\n")
    converted.append(str(path))

print("Converted to UTF-8:")
for item in converted:
    print(item)
