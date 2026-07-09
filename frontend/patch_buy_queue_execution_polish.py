from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\BuyQueue.tsx")
text = path.read_text()

if "FileDown," not in text:
    text = text.replace(
        """  Copy,
""",
        """  Copy,
  FileDown,
""",
    )

helper_block = '''
function escapeCsv(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).replaceAll('"', '""');

  return `"${text}"`;
}

'''

if "function escapeCsv" not in text:
    text = text.replace("function getDecisionClass", helper_block + "function getDecisionClass", 1)

extra_functions = '''
  function buildShoppingListText() {
    return visibleItems
      .filter((item) => item.status === "queued")
      .map((item) => item.item_name)
      .join("\\n");
  }

  function buildCsvText() {
    const rows = [
      [
        "Item",
        "Quantity",
        "Max Price Each",
        "Max Total Spend",
        "Target Sale Price Each",
        "Expected Profit",
        "Expected Margin Percent",
        "Decision",
        "Grade",
        "Signal",
        "Memory State",
        "Reason",
      ],
      ...visibleItems
        .filter((item) => item.status === "queued")
        .map((item) => [
          item.item_name,
          item.suggested_quantity,
          item.max_price_each,
          item.max_total_spend,
          item.target_sale_price_each,
          item.expected_total_profit,
          item.expected_margin_percent,
          item.final_decision ?? "",
          item.decision_grade ?? "",
          item.signal ?? "",
          item.memory_price_state ?? "",
          item.reason ?? "",
        ]),
    ];

    return rows
      .map((row) => row.map((value) => escapeCsv(value)).join(","))
      .join("\\n");
  }

  async function copyShoppingList() {
    try {
      const shoppingList = buildShoppingListText();

      if (!shoppingList.trim()) {
        setMessage("No queued items to copy.");
        return;
      }

      await navigator.clipboard.writeText(shoppingList);
      setMessage("Shopping list copied.");
    } catch {
      setError("Unable to copy shopping list.");
    }
  }

  async function copyCsv() {
    try {
      const csv = buildCsvText();

      if (!csv.trim()) {
        setMessage("No queued items to copy.");
        return;
      }

      await navigator.clipboard.writeText(csv);
      setMessage("CSV copied.");
    } catch {
      setError("Unable to copy CSV.");
    }
  }

  function downloadCsv() {
    const csv = buildCsvText();

    if (!csv.trim()) {
      setMessage("No queued items to export.");
      return;
    }

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `goldsmith-buy-queue-realm-${realm}.csv`;
    link.click();

    URL.revokeObjectURL(url);
    setMessage("Buy Queue CSV downloaded.");
  }

  async function convertToTrade(item: BuyQueueItem) {
    try {
      setWorking(true);
      setError("");
      setMessage("");

      await axios.post(`${API_BASE_URL}/trades/from-buy-queue/${item.id}`);

      setMessage(`${item.item_name} is now tracked in Profit Tracker.`);
      await loadQueue();
    } catch {
      setError("Unable to convert item into a tracked trade.");
    } finally {
      setWorking(false);
    }
  }

  async function markBoughtAndTrack(item: BuyQueueItem) {
    const quantityText = window.prompt(
      `Quantity bought for ${item.item_name}`,
      String(item.suggested_quantity),
    );

    if (!quantityText) {
      return;
    }

    const priceText = window.prompt(
      `Price paid each for ${item.item_name}`,
      String(Math.round(item.max_price_each)),
    );

    if (!priceText) {
      return;
    }

    const boughtQuantity = Number(quantityText);
    const boughtPriceEach = Number(priceText);

    if (
      !Number.isFinite(boughtQuantity) ||
      !Number.isFinite(boughtPriceEach) ||
      boughtQuantity <= 0 ||
      boughtPriceEach < 0
    ) {
      setError("Invalid quantity or price.");
      return;
    }

    try {
      setWorking(true);
      setError("");
      setMessage("");

      await axios.patch(`${API_BASE_URL}/buy-queue/${item.id}/mark-bought`, {
        bought_quantity: boughtQuantity,
        bought_price_each: boughtPriceEach,
        notes: "Marked bought and tracked from Buy Queue.",
      });

      await axios.post(`${API_BASE_URL}/trades/from-buy-queue/${item.id}`);

      setMessage(`${item.item_name} bought and sent to Profit Tracker.`);
      await loadQueue();
    } catch {
      setError("Unable to mark bought and track trade.");
    } finally {
      setWorking(false);
    }
  }

'''

if "function buildShoppingListText" not in text:
    text = text.replace("  async function copyText", extra_functions + "  async function copyText", 1)

if "Copy Shopping List" not in text:
    text = text.replace(
        """          <button
            type="button"
            onClick={importTopDecisions}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
          >
            <Upload size={16} />
            Import Top Buys
          </button>
""",
        """          <button
            type="button"
            onClick={importTopDecisions}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
          >
            <Upload size={16} />
            Import Top Buys
          </button>

          <button
            type="button"
            onClick={copyShoppingList}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
          >
            <Copy size={16} />
            Copy Shopping List
          </button>

          <button
            type="button"
            onClick={copyCsv}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
          >
            <Copy size={16} />
            Copy CSV
          </button>

          <button
            type="button"
            onClick={downloadCsv}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:opacity-60"
          >
            <FileDown size={16} />
            Export CSV
          </button>
""",
        1,
    )

if "Bought + Track" not in text:
    text = text.replace(
        """                            <button
                              type="button"
                              onClick={() => markBought(item)}
                              disabled={working}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-60"
                            >
                              <CheckCircle2 size={14} />
                              Bought
                            </button>
""",
        """                            <button
                              type="button"
                              onClick={() => markBought(item)}
                              disabled={working}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-60"
                            >
                              <CheckCircle2 size={14} />
                              Bought
                            </button>

                            <button
                              type="button"
                              onClick={() => markBoughtAndTrack(item)}
                              disabled={working}
                              className="inline-flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:opacity-60"
                            >
                              <Wallet size={14} />
                              Bought + Track
                            </button>
""",
        1,
    )

if "Track Trade" not in text:
    text = text.replace(
        """                        {item.status === "queued" && (
                          <>
""",
        """                        {item.status === "bought" && (
                          <button
                            type="button"
                            onClick={() => convertToTrade(item)}
                            disabled={working}
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:opacity-60"
                          >
                            <Wallet size={14} />
                            Track Trade
                          </button>
                        )}

                        {item.status === "queued" && (
                          <>
""",
        1,
    )

path.write_text(text)
print("BuyQueue.tsx patched with exports and Bought + Track.")
