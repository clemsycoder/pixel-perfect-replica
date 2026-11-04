import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Sprout, Mail, Lock, User, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import heroImg from "@/assets/hero-farmland.jpg";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    mode: typeof search.mode === "string" ? search.mode : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Lumora" },
      { name: "description", content: "Sign in to Lumora to trade Nigerian agricultural commodities." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { redirect, mode: modeParam } = Route.useSearch();
  const [tab, setTab] = useState<"signin" | "signup">(modeParam === "signup" ? "signup" : "signin");
  const [mode, setMode] = useState<Mode>(modeParam === "forgot" ? "forgot" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sentNotice, setSentNotice] = useState(false);

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      if (user) navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const destination = (redirect?.startsWith("/") ? redirect : undefined) ?? "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSentNotice(true);
      } else if (mode === "signup") {
        if (fullName.trim().length < 2) {
          toast.error("Enter your full name");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setSentNotice(true);
        } else {
          navigate({ to: destination, replace: true });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: destination, replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong — try again");
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: "google" | "lovable") {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      // If the browser didn't redirect (preview iframe flow), the session is
      // set — head to the dashboard.
      if (!result.redirected) navigate({ to: destination, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not start ${provider} sign-in`);
    } finally {
      setBusy(false);
    }
  }

  const switchTab = (next: "signin" | "signup") => {
    setTab(next);
    setMode(next);
    setSentNotice(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden lg:flex">
        <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ backgroundImage: "var(--gradient-hero)", background: "linear-gradient(115deg, rgba(2,13,11,0.95) 0%, rgba(2,13,11,0.6) 55%, rgba(2,13,11,0.25) 100%)" }}
        />
        <div className="relative z-10 p-10">
          <BrandMark />
        </div>
        <div className="relative z-10 max-w-md p-10">
          <h2 className="font-display text-3xl font-semibold leading-tight text-white">
            Trade Nigerian agriculture with confidence.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Live verified market prices, an NGN wallet, fractional commodity positions and physical
            delivery requests — all in one platform.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12">
        <div className="lg:absolute lg:left-8 lg:top-8">
          <div className="lg:hidden">
            <BrandMark />
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 hidden text-center lg:block lg:hidden" />
          <div className="mb-8 lg:hidden">
            <h1 className="font-display text-2xl font-semibold">
              {mode === "forgot" ? "Reset your password" : mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "forgot"
                ? "We'll email you a secure reset link."
                : mode === "signup"
                  ? "Start trading Nigerian commodities in minutes."
                  : "Sign in to continue trading."}
            </p>
          </div>

          {sentNotice ? (
            <div className="surface-raised glow-card rounded-xl border p-8 text-center">
              <Mail className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-4 font-display text-lg font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a {mode === "forgot" ? "password reset" : "confirmation"} link to{" "}
                <span className="text-foreground">{email.trim()}</span>. Follow the link to
                {mode === "forgot" ? " set a new password" : " activate your account"}.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => { setSentNotice(false); setMode("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              {mode !== "forgot" && (
                <Tabs value={mode} onValueChange={(v) => switchTab(v as "signin" | "signup")} className="mb-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="signin">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Create account</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="fullName" className="pl-9" placeholder="Adaeze Okafor" value={fullName}
                        onChange={(e) => setFullName(e.target.value)} required />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" className="pl-9" placeholder="you@example.com" value={email}
                      onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                  </div>
                </div>
                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {mode === "signin" && (
                        <button type="button" onClick={() => setMode("forgot")}
                          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="password" type="password" className="pl-9" placeholder="••••••••" value={password}
                        onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" />
                    : mode === "forgot" ? "Send reset link"
                    : mode === "signup" ? "Create account"
                    : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>

              {mode !== "forgot" && (
                <>
                  <div className="my-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">or continue with</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button type="button" variant="outline" disabled={busy} onClick={() => handleOAuth("google")}>
                      <GoogleIcon /> Google
                    </Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => handleOAuth("lovable")}>
                      <Sprout className="h-4 w-4" /> Lovable
                    </Button>
                  </div>
                  <p className="mt-6 text-center text-xs text-muted-foreground">
                    By continuing you agree to Lumora's terms of service and privacy policy.
                  </p>
                </>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5">
      <span className="gradient-primary flex h-9 w-9 items-center justify-center rounded-lg text-black">
        <Sprout className="h-5 w-5" />
      </span>
      <span className="font-display text-xl font-bold tracking-tight text-white">Lumora</span>
    </Link>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.87l3.66-2.83z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
