from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\PerformanceFeedback.tsx")
text = path.read_text()

text = text.replace(
    'className="min-w-[850px] w-full text-left text-sm"',
    'className="w-full text-left text-sm"',
)

text = text.replace(
    '<th className="px-4 py-3">Hold</th>',
    '<th className="px-3 py-3">Hold</th>',
)

text = text.replace(
    '<td className="px-4 py-4 text-slate-400">',
    '<td className="px-3 py-4 text-slate-400">',
)

path.write_text(text)

print("PerformanceFeedback.tsx table overflow reduced.")
