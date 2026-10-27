import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { requestEmailCode, verifyEmailCode, startGoogleSignIn, useGetSignInMethods, getGetSignInMethodsQueryKey, type AccountSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

export default function EmailSignIn({ onSignedIn }: { onSignedIn: (session: AccountSession) => void }) {
  const { data: available, isLoading: checkingMethods, isError: methodsFailed, refetch } = useGetSignInMethods({
    query: { queryKey: getGetSignInMethodsQueryKey(), staleTime: 0, refetchOnWindowFocus: true, retry: 1 },
  });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [addPassword, setAddPassword] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, setPending] = useState(false);
  const [methods, setMethods] = useState(false);
  const [error, setError] = useState(() => new URLSearchParams(window.location.search).get("authError") === "google"
    ? "Google sign-in could not be completed. Please try again or sign in with an email code." : "");
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(n => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError("");
    try { await action(); }
    catch (error) {
      const detail = (error as { data?: { error?: string } })?.data?.error;
      setError(detail || "We couldn’t complete sign-in. Please try again.");
    } finally { setPending(false); }
  }
  async function sendCode() {
    const result = await requestEmailCode({ email: email.trim().toLowerCase() });
    setChallengeId(result.challengeId);
    setCode("");
    setCooldown(result.resendAfterSeconds);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (!challengeId) { await sendCode(); return; }
      const session = await verifyEmailCode({ challengeId, code, ...(addPassword ? { password } : {}) });
      onSignedIn(session);
    });
  }
  return (
    <div className="relative min-h-[100dvh] w-full bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Language Tutor</h1>
          <p className="text-sm text-muted-foreground mt-1">Your personal language companion</p>
        </header>
        <section className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 sm:p-8">
          <h2 className="text-xl font-semibold">{challengeId ? "Check your email" : "Sign in or create an account"}</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            {challengeId ? `Enter the six-digit code sent to ${email}. It expires in 10 minutes.`
              : available?.emailCode ? "We’ll email you a one-time code. No password needed."
              : checkingMethods ? "Checking available sign-in methods…"
              : "Email-code sign-in is currently unavailable. You can use password sign-in below."}
          </p>
          {methodsFailed && <div role="alert" className="mb-4 text-sm text-destructive">
            Couldn’t check sign-in availability. <button type="button" className="underline" onClick={() => void refetch()}>Try again</button>
          </div>}
          {error && <div role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
            {!challengeId ? <div className="space-y-2">
              <Label htmlFor="code-email">Email</Label>
              <Input id="code-email" data-testid="input-code-email" type="email" autoComplete="email" required maxLength={254}
                value={email} onChange={e => setEmail(e.target.value)} disabled={pending} />
            </div> : <>
              <div className="space-y-2">
                <Label htmlFor="signin-code">Email code</Label>
                <Input id="signin-code" data-testid="input-email-code" inputMode="numeric" autoComplete="one-time-code"
                  required pattern="[0-9]{6}" maxLength={6} minLength={6} value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ""))} disabled={pending}
                  className="text-center text-xl tracking-[0.3em]" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={addPassword} disabled={pending} onChange={e => setAddPassword(e.target.checked)} />
                Set a password too (optional)
              </label>
              {addPassword && <div className="space-y-2">
                <Label htmlFor="optional-password">New password</Label>
                <Input id="optional-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
                  value={password} onChange={e => setPassword(e.target.value)} disabled={pending} aria-describedby="new-password-hint" />
                <p id="new-password-hint" className="text-xs text-muted-foreground">12–128 characters. This replaces any existing password and signs out other sessions.</p>
              </div>}
            </>}
            <Button className="w-full" type="submit" disabled={pending || !available?.emailCode}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Mail className="mr-2 h-4 w-4" aria-hidden />}
              {pending ? "Please wait…" : challengeId ? "Verify code and sign in" : "Email me a code"}
            </Button>
          </form>
          {challengeId && <div className="mt-4 space-y-2">
            <Button type="button" variant="ghost" className="w-full" disabled={pending || cooldown > 0} onClick={() => void run(sendCode)}>
              {cooldown ? `Resend code in ${cooldown}s` : "Resend code"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" disabled={pending} onClick={() => { setChallengeId(null); setError(""); setCode(""); setPassword(""); setAddPassword(false); }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Use a different email
            </Button>
          </div>}
          <div className="my-5 border-t border-border" />
          {available?.google && <Button variant="outline" className="w-full" disabled={pending} onClick={() => void run(async () => {
            const result = await startGoogleSignIn();
            window.location.assign(result.url);
          })}>Continue with Google</Button>}
          <Button variant="link" className="w-full mt-3 text-sm" disabled={pending} aria-expanded={methods} onClick={() => setMethods(v => !v)}>
            Sign in using another method
          </Button>
          {methods && <div className="mt-2 text-center">
            <Link className="text-sm text-primary underline underline-offset-4" href="/login/password">Sign in with password</Link>
          </div>}
        </section>
        <p className="mt-6 text-center text-xs text-muted-foreground">Your conversations and progress stay private to your account.</p>
      </div>
    </div>
  );
}
