from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\DealAlerts.tsx")
text = path.read_text()

if "const [queueingItem, setQueueingItem]" not in text:
    text = text.replace(
        """  const [ignoringCategory, setIgnoringCategory] = useState<string | null>(null);
""",
        """  const [ignoringCategory, setIgnoringCategory] = useState<string | null>(null);
  const [queueingItem, setQueueingItem] = useState<number | null>(null);
""",
    )

queue_function = '''
  async function queueBuy(alert: DealAlert) {
    try {
      setQueueingItem(alert.item_id);
      setError("");
      setSuccessMessage("");

      if (alert.suggested_buy_quantity <= 0) {
        setError("GoldSmith does not recommend buying this item.");
        return;
      }

      await axios.post(`${API_BASE_URL}/buy-queue/from-alert`, {
        item_id: alert.item_id,
        realm_id: alert.realm_id,
        item_name: alert.name,
        category: alert.goldsmith_category,
        icon_url: alert.icon_url,
        quality: alert.quality,
        decision_grade: alert.decision_grade,
        final_decision: alert.final_decision,
        decision_score: alert.decision_score,
        buy_pressure: alert.buy_pressure,
        position_size_label: alert.position_size_label,
        signal: alert.signal,
        memory_price_state: alert.memory_price_state,
        suggested_quantity: alert.suggested_buy_quantity,
        max_price_each: alert.suggested_buy_below,
        target_sale_price_each: alert.target_resale_price,
        expected_margin_percent: alert.estimated_margin_percent,
        reason: alert.decision_note || alert.signal_reason,
      });

      setSuccessMessage(`${alert.name} added to Buy Queue.`);
    } catch {
      setError("Unable to add item to Buy Queue.");
    } finally {
      setQueueingItem(null);
    }
  }

'''

if "async function queueBuy(alert: DealAlert)" not in text:
    text = text.replace("  useEffect(() => {", queue_function + "  useEffect(() => {", 1)

if "Queue Buy" not in text:
    text = text.replace(
        """                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => ignoreItem(topAlert)}
""",
        """                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => queueBuy(topAlert)}
                    disabled={queueingItem === topAlert.item_id}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/40 disabled:opacity-60"
                  >
                    <ShoppingCart size={14} />
                    Queue Buy
                  </button>

                  <button
                    type="button"
                    onClick={() => ignoreItem(topAlert)}
""",
        1,
    )

if "Queue" not in text[text.find("<tbody>"):]:
    text = text.replace(
        """                        <button
                          type="button"
                          onClick={() => ignoreItem(alert)}
                          disabled={ignoringItem === alert.item_id}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          <Ban size={14} />
                          Ignore
                        </button>
""",
        """                        <button
                          type="button"
                          onClick={() => queueBuy(alert)}
                          disabled={queueingItem === alert.item_id}
                          className="inline-flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/40 disabled:opacity-60"
                        >
                          <ShoppingCart size={14} />
                          Queue
                        </button>

                        <button
                          type="button"
                          onClick={() => ignoreItem(alert)}
                          disabled={ignoringItem === alert.item_id}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          <Ban size={14} />
                          Ignore
                        </button>
""",
        1,
    )

path.write_text(text)
print("DealAlerts.tsx patched with Queue Buy.")
