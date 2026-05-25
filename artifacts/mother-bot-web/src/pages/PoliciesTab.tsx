import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPolicies } from "@/lib/api";
import { haptic } from "@/lib/telegram";

export default function PoliciesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: getPolicies,
  });
  const [open, setOpen] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="panel p-6 text-center text-mute">
        <div className="text-3xl mb-2">📄</div>
        <div>لم تُنشر أي سياسات بعد</div>
        <div className="text-xs mt-2">ستظهر هنا فور إضافتها من قِبل الإدارة.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="panel-gold p-4">
        <div className="font-extrabold text-lg mb-1">📚 السياسات الرسمية</div>
        <div className="text-sm text-mute">
          الشروط والأحكام والسياسات الرسمية لمنظومة SOUQRATES.
        </div>
      </div>
      {data.map((p) => {
        const isOpen = open === p.id;
        return (
          <div key={p.id} className="panel overflow-hidden">
            <button
              onClick={() => {
                haptic("tap");
                setOpen(isOpen ? null : p.id);
              }}
              className="w-full text-start p-4 flex items-center justify-between hover:bg-white/5"
            >
              <div className="font-bold">{p.title}</div>
              <span className={`text-gold transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-line">
                <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap leading-7 text-fg/90 mt-3">
                  {p.body}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
