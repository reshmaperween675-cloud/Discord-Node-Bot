import React, { useState } from "react";
import { Sparkles, TerminalSquare, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Login() {
  const [discordId, setDiscordId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ discordId: discordId.trim(), password }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Invalid credentials.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background ambient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md p-8 glass-panel rounded-2xl border border-white/10 shadow-2xl relative z-10">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Control Center</h1>
            <p className="text-muted-foreground font-mono text-sm">SECURE ACCESS REQUIRED</p>
          </div>

          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <form onSubmit={handleSubmit} className="w-full space-y-4 pt-2">
            <div className="space-y-1 text-left">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Discord ID
              </label>
              <input
                type="text"
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                placeholder="e.g. 123456789012345678"
                required
                autoComplete="username"
                className="w-full h-11 px-4 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div className="space-y-1 text-left">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-11 px-4 pr-11 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 text-center font-mono">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 font-medium text-base mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {loading ? "Authenticating…" : "Access Control Center"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Restricted to authorized personnel. All actions are logged.
            </p>
          </form>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs font-mono text-muted-foreground/50 flex items-center gap-2">
        <TerminalSquare className="w-3 h-3" />
        LOWO SYSTEMS INC.
      </div>
    </div>
  );
}
