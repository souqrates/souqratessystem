import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type SignatureRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
};
type SignatureDetail = SignatureRow & {
  notes: string | null;
  signatureDataUrl: string;
  agreementContent: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export default function AgreementsPage() {
  const [tab, setTab] = useState<"text" | "signers">("text");

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">📜 الاتفاقيات</h1>
        <p className="text-sm text-slate-500 mt-1">
          إدارة نصّ الاتفاقية الرسمية وعرض الموقّعين عليها.
        </p>
      </div>

      <div className="flex gap-2 mb-4 border-b border-slate-200">
        <TabBtn active={tab === "text"} onClick={() => setTab("text")}>تعديل نصّ الاتفاقية</TabBtn>
        <TabBtn active={tab === "signers"} onClick={() => setTab("signers")}>الموقّعون</TabBtn>
      </div>

      {tab === "text" ? <AgreementTextEditor /> : <SignersList />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
        active
          ? "border-indigo-600 text-indigo-700"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Tab 1: edit the master agreement text ────────────────────────────────
function AgreementTextEditor() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const j = await api.get<{ content: string; updatedAt: string | null }>("/superadmin/agreement-text");
      setContent(j.content ?? "");
      setSavedAt(j.updatedAt ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true); setError(null);
    try {
      await api.put<{ success: boolean }>("/superadmin/agreement-text", { content });
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="font-semibold text-slate-900">نصّ الاتفاقية المنشورة على /agreement</div>
        {savedAt && (
          <div className="text-xs text-slate-500">
            آخر تحديث: {new Date(savedAt).toLocaleString("ar-EG")}
          </div>
        )}
      </div>
      <div className="p-5 space-y-4">
        {loading ? (
          <div className="text-slate-500 text-sm">جاري التحميل…</div>
        ) : (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              dir="rtl"
              className="w-full font-mono text-sm leading-7 bg-slate-50 border border-slate-200 rounded-md p-3 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="اكتب نصّ الاتفاقية هنا…"
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving || content.length < 10}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {saving ? "جاري الحفظ…" : "💾 حفظ"}
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="px-4 py-2 rounded-md bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
              >
                🔄 تحديث
              </button>
              <span className="text-xs text-slate-500 ms-2">
                يظهر فورًا على www.souqrates.com/agreement
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: signers list + viewer modal ──────────────────────────────────
function SignersList() {
  const [rows, setRows] = useState<SignatureRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SignatureDetail | null>(null);
  const [selLoading, setSelLoading] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const j = await api.get<{ total: number; rows: SignatureRow[] }>("/superadmin/agreements?limit=200");
      setRows(j.rows ?? []); setTotal(j.total ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function openDetail(id: number) {
    setSelLoading(true); setSelected(null);
    try {
      const j = await api.get<SignatureDetail>(`/superadmin/agreements/${id}`);
      setSelected(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSelLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="font-semibold text-slate-900">✍️ الموقّعون ({total})</div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
        >
          🔄 تحديث
        </button>
      </div>
      <div className="p-5">
        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
        {loading ? (
          <div className="text-slate-500 text-sm">جاري التحميل…</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">لم يوقّع أحد بعد على الاتفاقية.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-2 font-medium w-14">#</th>
                  <th className="px-3 py-2 font-medium">الاسم</th>
                  <th className="px-3 py-2 font-medium">البريد</th>
                  <th className="px-3 py-2 font-medium">الهاتف</th>
                  <th className="px-3 py-2 font-medium">التاريخ</th>
                  <th className="px-3 py-2 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">{r.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                    <td className="px-3 py-2 text-slate-700" dir="ltr">{r.email}</td>
                    <td className="px-3 py-2 text-slate-500" dir="ltr">{r.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(r.createdAt).toLocaleString("ar-EG")}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => openDetail(r.id)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        👁️ فتح
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(selLoading || selected) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <div className="font-semibold text-slate-900">📄 الاتفاقية الموقّعة</div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-500 hover:text-slate-900 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              {selLoading || !selected ? (
                <div className="text-slate-500 text-sm py-6">جاري التحميل…</div>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="الاسم" value={selected.name} />
                    <Field label="البريد" value={selected.email} ltr />
                    <Field label="الهاتف" value={selected.phone ?? "—"} ltr />
                    <Field label="التاريخ" value={new Date(selected.createdAt).toLocaleString("ar-EG")} />
                    <Field label="IP" value={selected.ipAddress ?? "—"} ltr />
                    <Field label="رقم التسجيل" value={`#${selected.id}`} />
                  </div>

                  {selected.notes && <Field label="ملاحظات المستخدم" value={selected.notes} multiline />}

                  <div>
                    <div className="text-xs text-slate-500 mb-1">نصّ الاتفاقية كما وُقِّع عليه</div>
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 max-h-60 overflow-y-auto whitespace-pre-wrap text-[13px] leading-7 text-slate-800">
                      {selected.agreementContent}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 mb-1">التوقيع</div>
                    <div className="bg-white rounded-md p-2 inline-block border border-slate-200">
                      <img src={selected.signatureDataUrl} alt="signature" className="max-w-full max-h-48" />
                    </div>
                  </div>

                  {selected.userAgent && (
                    <p className="text-[11px] text-slate-400 break-all">UA: {selected.userAgent}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, ltr, multiline }: { label: string; value: string; ltr?: boolean; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div
        className={`font-medium text-slate-900 ${multiline ? "whitespace-pre-wrap" : ""}`}
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </div>
    </div>
  );
}
