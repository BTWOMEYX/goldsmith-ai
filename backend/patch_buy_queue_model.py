from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\models.py")
text = path.read_text()

if "class BuyQueueItem(Base):" not in text:
    text += '''


class BuyQueueItem(Base):
    __tablename__ = "buy_queue_items"

    id = Column(Integer, primary_key=True, index=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)
    realm_name = Column(String, nullable=False)

    item_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    icon_url = Column(String, nullable=True)
    quality = Column(String, nullable=True)

    decision_grade = Column(String, nullable=True)
    final_decision = Column(String, nullable=True)
    decision_score = Column(Float, nullable=False, default=0)
    buy_pressure = Column(String, nullable=True)
    position_size_label = Column(String, nullable=True)

    signal = Column(String, nullable=True)
    memory_price_state = Column(String, nullable=True)

    suggested_quantity = Column(Integer, nullable=False, default=1)
    max_price_each = Column(Float, nullable=False, default=0)
    max_total_spend = Column(Float, nullable=False, default=0)

    target_sale_price_each = Column(Float, nullable=False, default=0)
    expected_profit_each = Column(Float, nullable=False, default=0)
    expected_total_profit = Column(Float, nullable=False, default=0)
    expected_margin_percent = Column(Float, nullable=False, default=0)

    status = Column(String, index=True, nullable=False, default="queued")

    bought_quantity = Column(Integer, nullable=False, default=0)
    bought_price_each = Column(Float, nullable=False, default=0)
    total_buy_cost = Column(Float, nullable=False, default=0)

    reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    bought_at = Column(DateTime(timezone=True), nullable=True)
'''

path.write_text(text)
print("BuyQueueItem added to models.py")
