from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\models.py")
text = path.read_text()

if "class TradeEntry(Base):" not in text:
    text += '''


class TradeEntry(Base):
    __tablename__ = "trade_entries"

    id = Column(Integer, primary_key=True, index=True)

    buy_queue_item_id = Column(Integer, index=True, nullable=True)

    item_id = Column(Integer, index=True, nullable=False)
    realm_id = Column(Integer, index=True, nullable=False)
    realm_name = Column(String, nullable=False)

    item_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    icon_url = Column(String, nullable=True)
    quality = Column(String, nullable=True)

    quantity_bought = Column(Integer, nullable=False, default=1)
    buy_price_each = Column(Float, nullable=False, default=0)
    total_buy_cost = Column(Float, nullable=False, default=0)

    target_sale_price_each = Column(Float, nullable=False, default=0)
    expected_total_sale_value = Column(Float, nullable=False, default=0)
    expected_profit = Column(Float, nullable=False, default=0)
    expected_roi_percent = Column(Float, nullable=False, default=0)

    quantity_sold = Column(Integer, nullable=False, default=0)
    actual_sale_price_each = Column(Float, nullable=False, default=0)
    gross_sale_value = Column(Float, nullable=False, default=0)
    sale_fee_percent = Column(Float, nullable=False, default=5)
    sale_fee_value = Column(Float, nullable=False, default=0)
    net_sale_value = Column(Float, nullable=False, default=0)

    realized_profit = Column(Float, nullable=False, default=0)
    roi_percent = Column(Float, nullable=False, default=0)

    status = Column(String, index=True, nullable=False, default="open")

    decision_grade = Column(String, nullable=True)
    final_decision = Column(String, nullable=True)
    decision_score = Column(Float, nullable=False, default=0)

    signal = Column(String, nullable=True)
    memory_price_state = Column(String, nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    sold_at = Column(DateTime(timezone=True), nullable=True)
'''

path.write_text(text)
print("TradeEntry added to models.py")
