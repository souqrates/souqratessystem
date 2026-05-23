import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, AlertCircle } from "lucide-react";
import {
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  loginAsAdmin,
} from "@/lib/admin-token";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Renders a centred login form when no admin token is stored OR when the
 * stored token has been rejected by the server. Children only mount once
 * an admin token has been verified.
 *
 * On every mount we re-verify the stored token against /api/admin/login,
 * which guarantees a stale token (e.g. ADMIN_TOKEN rotated server-side)
 * cannot keep an old session alive on the client.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  // 'checking' | 'login' | 'authed'
  const [status, setStatus] = useState<"checking" | "login" | "authed">("checking");
  const [tokenInput, setTokenInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = getAdminToken();
    if (!stored) { setStatus("login"); return; }
    (async () => {
      try {
        const ok = await loginAsAdmin(stored);
        if (cancelled) return;
        if (ok) setStatus("authed");
        else { clearAdminToken(); setStatus("login"); }
      } catch {
        if (cancelled) return;
        // Network/5xx: treat as not authed but let the user retry.
        clearAdminToken();
        setStatus("login");
        setErrorMsg("تعذّر الاتصال بالخادم. حاول مجدداً.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim() || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const ok = await loginAsAdmin(tokenInput.trim());
      if (ok) {
        setAdminToken(tokenInput.trim());
        setStatus("authed");
        setTokenInput("");
      } else {
        setErrorMsg("رمز الدخول غير صحيح");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">جاري التحقق…</div>
      </div>
    );
  }

  if (status === "authed") return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-center text-xl">لوحة تحكم البوت الأم</CardTitle>
          <CardDescription className="text-center">
            أدخل رمز الإدارة للمتابعة
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-token">رمز الإدارة (ADMIN_TOKEN)</Label>
              <Input
                id="admin-token"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="••••••••••••••••"
                autoFocus
                autoComplete="current-password"
                dir="ltr"
                required
              />
            </div>
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={submitting || !tokenInput.trim()}>
              {submitting ? "جاري التحقق…" : "دخول"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

/** Top-right "logout" affordance for use inside the admin layout. */
export function AdminSignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => { clearAdminToken(); window.location.reload(); }}
    >
      خروج
    </Button>
  );
}
