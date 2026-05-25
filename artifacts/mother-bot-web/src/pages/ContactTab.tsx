import { useQuery } from "@tanstack/react-query";
import { getPlatformLinks } from "@/lib/api";
import { haptic } from "@/lib/telegram";

const KIND_META: Record<string, { icon: string; color: string }> = {
  tiktok:    { icon: "🎵", color: "#fe2c55" },
  instagram: { icon: "📷", color: "#e1306c" },
  telegram:  { icon: "✈️", color: "#229ED9" },
  whatsapp:  { icon: "💬", color: "#25D366" },
  youtube:   { icon: "▶️", color: "#FF0000" },
  twitter:   { icon: "𝕏",   color: "#ffffff" },
  facebook:  { icon: "f",   color: "#1877F2" },
  email:     { icon: "✉️", color: "#eab308" },
  phone:     { icon: "📞", color: "#34d399" },
  website:   { icon: "🌐", color: "#eab308" },
  custom:    { icon: "🔗", color: "#eab308" },
};

export default function ContactTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["platformLinks"],
    queryFn: getPlatformLinks,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel-gold p-5 text-center">
        <div className="text-3xl mb-2">💬</div>
        <div className="font-extrabold text-lg mb-1">تواصل مع SOUQRATES</div>
        <div className="text-sm text-mute">
          القنوات الرسمية للمنظومة. تواصل معنا عبر إحدى الوسائل أدناه.
        </div>
      </div>

      {!data || data.length === 0 ? (
        <div className="panel p-6 text-center text-mute">
          <div className="text-3xl mb-2">🔌</div>
          <div>لم تُضف روابط تواصل بعد</div>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((link) => {
            const meta = KIND_META[link.kind] ?? KIND_META.custom;
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => haptic("tap")}
                className="panel p-4 flex items-center gap-3 hover:border-gold/40 transition-colors block"
              >
                <div
                  className="w-12 h-12 rounded-xl grid place-items-center text-xl font-black"
                  style={{
                    background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)`,
                    color: "#0a0a0f",
                  }}
                >
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{link.label}</div>
                  <div className="text-xs text-mute truncate">{link.url}</div>
                </div>
                <div className="text-gold text-xl">↗</div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
