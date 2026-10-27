import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  mode: "login" | "register";
  onSubmit: (email: string, password: string) => Promise<void>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountPage({ mode, onSubmit }: Props) {
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    const e = email.trim();
    if (!e) errs.email = "Enter your email address.";
    else if (e.length > 254) errs.email = "Email must be 254 characters or fewer.";
    else if (!EMAIL_RE.test(e)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Enter your password.";
    else if (password.length < 12) errs.password = "Password must be at least 12 characters.";
    else if (password.length > 128) errs.password = "Password must be 128 characters or fewer.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (pending) return;
    setError(null);
    if (!validate()) return;
    setPending(true);
    try {
      await onSubmit(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Language Tutor</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Your personal language companion</p>
        </div>

        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight" data-testid="text-account-title">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {isRegister
              ? "Your conversations and progress stay private to you."
              : "Sign in to pick up where you left off."}
          </p>

          {error && (
            <div
              role="alert"
              data-testid="status-account-error"
              className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={pending}>
            <div className="space-y-1.5">
              <Label htmlFor="account-email">Email</Label>
              <Input
                id="account-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                required
                value={email}
                disabled={pending}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "account-email-error" : undefined}
                data-testid="input-email"
              />
              {fieldErrors.email && (
                <p id="account-email-error" className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account-password">Password</Label>
              <Input
                id="account-password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={12}
                maxLength={128}
                required
                value={password}
                disabled={pending}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={
                  fieldErrors.password ? "account-password-error" : "account-password-hint"
                }
                data-testid="input-password"
              />
              {fieldErrors.password ? (
                <p id="account-password-error" className="text-xs text-destructive">{fieldErrors.password}</p>
              ) : (
                <p id="account-password-hint" className="text-xs text-muted-foreground">
                  12 to 128 characters.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full font-medium" disabled={pending} data-testid="button-submit">
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {pending
                ? isRegister ? "Creating account..." : "Signing in..."
                : isRegister ? "Create account" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isRegister ? "Already have an account? " : "New here? "}
          <Link
            href={isRegister ? "/login/password" : "/register/password"}
            className="font-medium text-primary underline-offset-4 hover:underline"
            data-testid={isRegister ? "link-login" : "link-register"}
          >
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <p className="mt-3 text-center text-sm">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">Sign in with an email code instead</Link>
        </p>
      </div>
    </div>
  );
}
