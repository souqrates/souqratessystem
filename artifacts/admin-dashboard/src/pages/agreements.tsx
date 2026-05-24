import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { withAdminAuth } from "@/lib/admin-token";
import { Loader2, Save, Eye, FileSignature, RefreshCw } from "lucide-react";

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
  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">الاتفاقيات</h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة نصّ الاتفاقية الرسمية وعرض الموقّعين عليها.</p>
      </div>

      <Tabs defaultValue="text" className="space-y-4">
        <TabsList className="bg-card/50">
          <TabsTrigger value="text">تعديل نصّ الاتفاقية</TabsTrigger>
          <TabsTrigger value="signers">الموقّعون</TabsTrigger>
        </TabsList>

        <TabsContent value="text"><AgreementTextEditor /></TabsContent>
        <TabsContent value="signers"><SignersList /></TabsContent>
      </Tabs>
    </div>
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
      const r = await fetch("/api/admin/agreement-text", withAdminAuth());
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
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
      const r = await fetch("/api/admin/agreement-text", withAdminAuth({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }));
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>نصّ الاتفاقية المنشورة على /agreement</span>
          {savedAt && (
            <span className="text-xs text-muted-foreground font-normal">
              آخر تحديث: {new Date(savedAt).toLocaleString("ar-EG")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>
        ) : (
          <>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={18}
              dir="rtl"
              className="font-mono text-sm leading-7 bg-background/60 resize-y"
              placeholder="اكتب نصّ الاتفاقية هنا…"
            />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={saving || content.length < 10}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin ms-2" /> جاري الحفظ…</> : <><Save className="w-4 h-4 ms-2" /> حفظ</>}
              </Button>
              <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 ms-2" /> تحديث</Button>
              <span className="text-xs text-muted-foreground ms-2">يظهر فورًا على www.souqrates.com/agreement</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
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
      const r = await fetch("/api/admin/agreements?limit=200", withAdminAuth());
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
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
      const r = await fetch(`/api/admin/agreements/${id}`, withAdminAuth());
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSelected(await r.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSelLoading(false);
    }
  }

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><FileSignature className="w-4 h-4" /> الموقّعون ({total})</span>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="w-3.5 h-3.5 ms-2" /> تحديث</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لم يوقّع أحد بعد على الاتفاقية.</p>
        ) : (
          <div className="rounded-md border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-16">#</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">البريد</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="hover:bg-white/[0.02]">
                    <TableCell className="text-right text-muted-foreground">{r.id}</TableCell>
                    <TableCell className="text-right font-medium">{r.name}</TableCell>
                    <TableCell className="text-right text-sm" dir="ltr">{r.email}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground" dir="ltr">{r.phone ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString("ar-EG")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(r.id)}>
                        <Eye className="w-3.5 h-3.5 ms-1" /> فتح
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={selLoading || !!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>الاتفاقية الموقّعة</DialogTitle>
          </DialogHeader>
          {selLoading || !selected ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</div>
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
                <div className="text-xs text-muted-foreground mb-1">نصّ الاتفاقية كما وُقِّع عليه</div>
                <div className="bg-background/60 border border-border/40 rounded-md p-3 max-h-60 overflow-y-auto whitespace-pre-wrap text-[13px] leading-7">
                  {selected.agreementContent}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">التوقيع</div>
                <div className="bg-white rounded-md p-2 inline-block border border-border/40">
                  <img src={selected.signatureDataUrl} alt="signature" className="max-w-full max-h-48" />
                </div>
              </div>

              {selected.userAgent && (
                <p className="text-[11px] text-muted-foreground/70 break-all">UA: {selected.userAgent}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, value, ltr, multiline }: { label: string; value: string; ltr?: boolean; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`font-medium ${multiline ? "whitespace-pre-wrap" : ""}`} dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}
