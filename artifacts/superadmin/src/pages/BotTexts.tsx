import { useState } from "react";
import { MessageSquare } from "lucide-react";
import BotTextsEditor from "@/components/BotTextsEditor";

const BOT_SLUGS = [
  { slug: "mother-bot",    label: "SOUQRATES SYSTEM" },
  { slug: "games-bot",     label: "SOUQRATES SKILLZ" },
  { slug: "books-bot",     label: "SOUQRATES SOUQ" },
  { slug: "scratchy-bot",  label: "SOUQRATES SCRATCHY" },
  { slug: "contests-bot",  label: "SOUQRATES STAGE" },
  { slug: "subagents-bot", label: "SOUQRATES SUB-AGENTS" },
];

export default function BotTextsPage() {
  const [selectedSlug, setSelectedSlug] = useState(BOT_SLUGS[0].slug);

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="text-indigo-500" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">نصوص البوتات</h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              تحرير وإدارة نصوص كل بوت — اختر البوت ثم عدّل أي نص
            </p>
          </div>
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-1 mb-6 shadow-sm flex flex-wrap gap-1">
        {BOT_SLUGS.map((b) => (
          <button
            key={b.slug}
            onClick={() => setSelectedSlug(b.slug)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              selectedSlug === b.slug
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <BotTextsEditor botSlug={selectedSlug} />
    </div>
  );
}
