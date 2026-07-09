from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\models.py")
text = path.read_text()

marker = "Base = declarative_base()"

if marker not in text:
    raise RuntimeError("Could not find Base = declarative_base() in models.py")

after_base = text.split(marker, 1)[1]

fixed_header = '''from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()'''

path.write_text(fixed_header + after_base)

print("models.py SQLAlchemy imports repaired.")
