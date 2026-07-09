from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\models.py")
text = path.read_text()

lines = text.splitlines()
next_lines = []

for line in lines:
    if line.startswith("from sqlalchemy import") and "Boolean" not in line:
        line = line + ", Boolean"
    next_lines.append(line)

text = "\n".join(next_lines)

if "class PlanItemAction(Base):" not in text:
    text += '''


class PlanItemAction(Base):
    __tablename__ = "plan_item_actions"

    id = Column(Integer, primary_key=True, index=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)
    item_name = Column(String, nullable=True)

    action_type = Column(String, index=True, nullable=False)
    reason = Column(Text, nullable=True)

    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
'''

path.write_text(text)

print("PlanItemAction added to models.py")
