import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock, CheckCircle, ShoppingCart, TrendingUp, Coins, Pause, Download, X, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { BookCoverPicker } from "@/components/BookCoverPicker";

type Product = {
  id: number;
  publisherTelegramId: string;
  categoryId: number | null;
  title: string;
  description: string;
  coverUrl: string | null;
  fileUrl: string;
  fileSize: number;
  priceUsdt: string;
  status: "pending" | "approved" | "rejected" | "disabled";
  rejectionReason: string | null;
  salesCount: number;
  rating: string;
  ratingCount: number;
  createdAt: string;
};

type Category = {
  id: number; slug: string; nameAr: string; icon: string; sortOrder: number;
};

type Stats = {
  totalProducts: number;
  pendingCount: number;
  approvedCount: number;
  totalPurchases: number;
  volumeSkz: string;
  commissionSkz: string;
  topPublishers: { publisherTelegramId: string; netSkz: string; sales: number }[];
};

export default function BooksPage() {
  const [tab, setTab] = useState<"products" | "categories" | "stats" | "covers" | "shop">("products");
  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#0F766E" }}>SOUQRATES SOUQ — الكتب والمنتجات الرقمية</h1>
        <p className="text-sm text-slate-500 mt-1">مراجعة الكتب المرسلة، إدارة التصنيفات، ومتابعة المبيعات.</p>
      </div>
      <div className="flex gap-2 mb-4 border-b border-slate-200 flex-wrap">
        <TabBtn active={tab === "products"}   onClick={() => setTab("products")}>الكتب</TabBtn>
        <TabBtn active={tab === "categories"} onClick={() => setTab("categories")}>التصنيفات</TabBtn>
        <TabBtn active={tab === "shop"}       onClick={() => setTab("shop")}>🛍️ المتجر</TabBtn>
        <TabBtn active={tab === "stats"}      onClick={() => setTab("stats")}>الإحصاءات</TabBtn>
        <TabBtn active={tab === "covers"}     onClick={() => setTab("covers")}>إنشاء أغلفة</TabBtn>
      </div>
      {tab === "products"   && <ProductsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "shop"       && <ShopTab />}
      {tab === "stats"      && <StatsTab />}
      {tab === "covers"     && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="mb-4">
            <div className="font-semibold text-slate-900 text-base">مولّد أغلفة الكتب</div>
            <p className="text-sm text-slate-500 mt-1">
              اختر تصميماً من 10 قوالب جاهزة تناسب كل أنواع الكتب — اكتب العنوان وستظهر على جميع الأغلفة فوراً.
            </p>
          </div>
          <BookCoverPicker />
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
        active ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Products tab ─────────────────────────────────────────────────────────
function ProductsTab() {
  const [rows, setRows] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [status, setStatus] = useState<string>("pending");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const j = await api.get<{ data: Product[] }>(`/superadmin/books/products?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}&limit=200`);
      setRows(j.data ?? []);
      const c = await api.get<{ data: Category[] }>("/superadmin/books/categories");
      setCats(c.data ?? []);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [status]);

  const catName = useMemo(() => {
    const m = new Map<number, Category>(); for (const c of cats) m.set(c.id, c); return m;
  }, [cats]);

  async function setProductStatus(id: number, st: string, reason?: string) {
    try {
      await api.patch(`/superadmin/books/products/${id}`, { status: st, rejectionReason: reason });
      setSelected(null); void load();
    } catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="font-semibold text-slate-900">الكتب ({rows.length})</div>
        <div className="flex-1" />
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white">
          <option value="pending">قيد المراجعة</option>
          <option value="approved">معتمد</option>
          <option value="rejected">مرفوض</option>
          <option value="disabled">معطّل</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…"
          className="text-sm border border-slate-200 rounded-md px-3 py-1.5 w-48"
          onKeyDown={(e) => e.key === "Enter" && load()} />
        <button onClick={load} className="text-sm px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200">↺</button>
      </div>
      <div className="p-5">
        {error && <p className="text-rose-600 text-sm mb-3">{error}</p>}
        {loading ? (
          <div className="text-slate-500 text-sm">جاري التحميل…</div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-500 py-8 text-sm">لا يوجد كتب في هذه الحالة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-2 font-medium w-12">#</th>
                  <th className="px-3 py-2 font-medium">العنوان</th>
                  <th className="px-3 py-2 font-medium">التصنيف</th>
                  <th className="px-3 py-2 font-medium">السعر (SKZ)</th>
                  <th className="px-3 py-2 font-medium">المبيعات</th>
                  <th className="px-3 py-2 font-medium">الناشر</th>
                  <th className="px-3 py-2 font-medium w-32">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">{r.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.title}</td>
                    <td className="px-3 py-2 text-slate-600">{r.categoryId ? `${catName.get(r.categoryId)?.icon ?? ""} ${catName.get(r.categoryId)?.nameAr ?? "—"}` : "—"}</td>
                    <td className="px-3 py-2 text-slate-700" dir="ltr">{parseFloat(r.priceUsdt).toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-500">{r.salesCount}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono text-xs" dir="ltr">{r.publisherTelegramId}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => setSelected(r)} className="text-teal-700 hover:text-teal-900 text-sm font-medium">مراجعة</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <div className="font-semibold text-slate-900">{selected.title}</div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-900 flex items-center justify-center"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {selected.coverUrl && <img src={selected.coverUrl} alt="cover" className="max-h-60 rounded-md border border-slate-200" />}
              <Field label="الوصف" value={selected.description} multiline />
              <div className="grid grid-cols-2 gap-3">
                <Field label="السعر (SKZ)" value={parseFloat(selected.priceUsdt).toFixed(2)} ltr />
                <Field label="المبيعات" value={String(selected.salesCount)} />
                <Field label="الحالة" value={selected.status} ltr />
                <Field label="الناشر (TG ID)" value={selected.publisherTelegramId} ltr />
              </div>
              <Field label="رابط الملف" value={selected.fileUrl} ltr />
              {selected.rejectionReason && <Field label="سبب الرفض" value={selected.rejectionReason} multiline />}
              <div className="flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
                <button onClick={() => setProductStatus(selected.id, "approved")}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center gap-1"><CheckCircle size={13} /> اعتماد</button>
                <button onClick={() => {
                  const r = prompt("سبب الرفض:") ?? ""; if (r.trim()) setProductStatus(selected.id, "rejected", r);
                }} className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 flex items-center gap-1"><X size={13} /> رفض</button>
                <button onClick={() => setProductStatus(selected.id, "disabled")}
                  className="px-4 py-2 rounded-md bg-slate-600 text-white text-sm font-medium hover:bg-slate-700 flex items-center gap-1"><Pause size={13} /> تعطيل</button>
                <a href={selected.fileUrl} target="_blank" rel="noreferrer"
                  className="px-4 py-2 rounded-md bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 flex items-center gap-1"><Download size={13} /> فتح الملف</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Categories tab ───────────────────────────────────────────────────────
function CategoriesTab() {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ slug: "", nameAr: "", icon: "", sortOrder: 0 });

  async function load() {
    setLoading(true);
    try { const j = await api.get<{ data: Category[] }>("/superadmin/books/categories"); setRows(j.data ?? []); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function create() {
    try {
      await api.post("/superadmin/books/categories", draft);
      setDraft({ slug: "", nameAr: "", icon: "", sortOrder: 0 }); void load();
    } catch (e) { alert((e as Error).message); }
  }
  async function del(id: number) {
    if (!confirm("حذف هذا التصنيف؟")) return;
    try { await api.del(`/superadmin/books/categories/${id}`); void load(); } catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-900">التصنيفات</div>
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2 items-end p-3 bg-slate-50 rounded-md border border-slate-200">
          <Input label="Slug" value={draft.slug} onChange={(v) => setDraft({ ...draft, slug: v })} placeholder="religious" />
          <Input label="الاسم بالعربية" value={draft.nameAr} onChange={(v) => setDraft({ ...draft, nameAr: v })} placeholder="كتب دينية" />
          <Input label="أيقونة" value={draft.icon} onChange={(v) => setDraft({ ...draft, icon: v })} className="w-20" />
          <Input label="ترتيب" value={String(draft.sortOrder)} onChange={(v) => setDraft({ ...draft, sortOrder: parseInt(v, 10) || 0 })} className="w-20" />
          <button onClick={create} disabled={!draft.slug || !draft.nameAr}
            className="px-4 py-2 rounded-md bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 disabled:bg-slate-300 flex items-center gap-1"><Plus size={13} /> إضافة</button>
        </div>
        {error && <p className="text-rose-600 text-sm">{error}</p>}
        {loading ? <p className="text-slate-500 text-sm">جاري التحميل…</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs text-slate-500 border-b border-slate-200">
                <th className="px-3 py-2">الأيقونة</th>
                <th className="px-3 py-2">الاسم</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">الترتيب</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-xl">{c.icon}</td>
                  <td className="px-3 py-2 font-medium">{c.nameAr}</td>
                  <td className="px-3 py-2 text-slate-500 font-mono text-xs" dir="ltr">{c.slug}</td>
                  <td className="px-3 py-2 text-slate-500">{c.sortOrder}</td>
                  <td className="px-3 py-2"><button onClick={() => del(c.id)} className="text-rose-600 hover:text-rose-800 text-sm">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Stats tab ────────────────────────────────────────────────────────────
function StatsTab() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.get<Stats>("/superadmin/books/stats").then(setS).catch((e) => setErr((e as Error).message));
  }, []);
  if (err) return <p className="text-rose-600 text-sm">{err}</p>;
  if (!s) return <p className="text-slate-500 text-sm">جاري التحميل…</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي الكتب" value={String(s.totalProducts)} icon={<BookOpen size={22} />} />
        <StatCard label="قيد المراجعة" value={String(s.pendingCount)} icon={<Clock size={22} />} color="#f59e0b" />
        <StatCard label="معتمدة" value={String(s.approvedCount)} icon={<CheckCircle size={22} />} color="#10b981" />
        <StatCard label="إجمالي المبيعات" value={String(s.totalPurchases)} icon={<ShoppingCart size={22} />} />
        <StatCard label="حجم التداول (SKZ)" value={parseFloat(s.volumeSkz).toFixed(2)} icon={<TrendingUp size={22} />} color="#0F766E" />
        <StatCard label="إجمالي العمولات (SKZ)" value={parseFloat(s.commissionSkz).toFixed(2)} icon={<Coins size={22} />} color="#D4AF37" />
      </div>
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold">أفضل 5 ناشرين</div>
        <div className="p-5">
          {s.topPublishers.length === 0 ? <p className="text-slate-500 text-sm">لا توجد مبيعات بعد.</p> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-2">الناشر (TG ID)</th>
                  <th className="px-3 py-2">المبيعات</th>
                  <th className="px-3 py-2">صافي الأرباح (SKZ)</th>
                </tr>
              </thead>
              <tbody>
                {s.topPublishers.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">{p.publisherTelegramId}</td>
                    <td className="px-3 py-2">{p.sales}</td>
                    <td className="px-3 py-2 font-semibold" dir="ltr">{parseFloat(p.netSkz).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shop Products Tab ───────────────────────────────────────────────────────
type ShopProduct = {
  id: number;
  categorySlug: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  priceSkz: string;
  coverUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

function ShopTab() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ShopProduct> | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ data: ShopProduct[]; total: number }>("/superadmin/books/shop?limit=200");
      setProducts(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await api.patch<ShopProduct>(`/superadmin/books/shop/${editing.id}`, editing);
      } else {
        await api.post<ShopProduct>("/superadmin/books/shop", editing);
      }
      setEditing(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "خطأ في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: ShopProduct) {
    await api.patch(`/superadmin/books/shop/${p.id}`, { isActive: !p.isActive });
    await load();
  }

  async function remove(id: number) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    await api.del(`/superadmin/books/shop/${id}`);
    await load();
  }

  const CATEGORY_LABELS: Record<string, string> = { books: "📚 كتب", cups: "☕ كوسات" };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-slate-700">منتجات المتجر ({products.length})</div>
        <button
          onClick={() => setEditing({ categorySlug: "books", isActive: true, sortOrder: 0 })}
          className="px-4 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 flex items-center gap-1"
        >
          <Plus size={14} /> منتج جديد
        </button>
      </div>

      {editing && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 mb-5 space-y-3">
          <div className="font-semibold text-teal-800 text-sm mb-2">
            {editing.id ? "تعديل منتج" : "إضافة منتج جديد"}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">التصنيف</div>
              <select value={editing.categorySlug ?? "books"}
                onChange={e => setEditing({ ...editing, categorySlug: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full">
                <option value="books">📚 كتب</option>
                <option value="cups">☕ كوسات</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">السعر (SKZ)</div>
              <input type="number" value={editing.priceSkz ?? ""} step="0.01"
                onChange={e => setEditing({ ...editing, priceSkz: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">الاسم (عربي)</div>
              <input value={editing.nameAr ?? ""}
                onChange={e => setEditing({ ...editing, nameAr: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">الاسم (إنجليزي)</div>
              <input value={editing.nameEn ?? ""}
                onChange={e => setEditing({ ...editing, nameEn: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full" dir="ltr" />
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500 mb-1">الوصف (عربي)</div>
              <textarea value={editing.descriptionAr ?? ""}
                onChange={e => setEditing({ ...editing, descriptionAr: e.target.value })}
                rows={2} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full resize-none" />
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500 mb-1">رابط الصورة</div>
              <input value={editing.coverUrl ?? ""} dir="ltr"
                onChange={e => setEditing({ ...editing, coverUrl: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full font-mono text-xs" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">الترتيب</div>
              <input type="number" value={editing.sortOrder ?? 0}
                onChange={e => setEditing({ ...editing, sortOrder: parseInt(e.target.value) || 0 })}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full" />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" checked={editing.isActive ?? true}
                onChange={e => setEditing({ ...editing, isActive: e.target.checked })}
                className="w-4 h-4" id="is-active-chk" />
              <label htmlFor="is-active-chk" className="text-sm text-slate-700">مفعّل</label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving}
              className="px-5 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
              {saving ? "جاري الحفظ…" : "حفظ"}
            </button>
            <button onClick={() => setEditing(null)}
              className="px-5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-400 py-8 text-sm">جاري التحميل…</div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3">المنتج</th>
                <th className="px-4 py-3">التصنيف</th>
                <th className="px-4 py-3">السعر (SKZ)</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الترتيب</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">لا توجد منتجات</td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium">{p.nameAr}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{CATEGORY_LABELS[p.categorySlug] ?? p.categorySlug}</td>
                  <td className="px-4 py-2.5 font-semibold text-teal-700" dir="ltr">{parseFloat(p.priceSkz).toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => void toggleActive(p)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.isActive ? "مفعّل" : "معطّل"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{p.sortOrder}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(p)} className="text-xs text-indigo-600 hover:underline">تعديل</button>
                      <button onClick={() => void remove(p.id)} className="text-xs text-red-500 hover:underline">حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="opacity-60" style={color ? { color } : undefined}>{icon}</span>
        <span className="text-2xl font-bold" style={color ? { color } : undefined}>{value}</span>
      </div>
    </div>
  );
}

function Field({ label, value, ltr, multiline }: { label: string; value: string; ltr?: boolean; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className={`text-slate-900 ${multiline ? "whitespace-pre-wrap" : ""} ${ltr ? "font-mono text-xs break-all" : ""}`} dir={ltr ? "ltr" : undefined}>{value || "—"}</div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] text-slate-500 mb-1">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="text-sm border border-slate-200 rounded-md px-3 py-1.5 w-full" />
    </div>
  );
}
