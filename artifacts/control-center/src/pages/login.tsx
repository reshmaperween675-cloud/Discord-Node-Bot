import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, TerminalSquare } from "lucide-react";
import { SiDiscord } from "react-icons/si";

export default function Login() {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background ambient effects */}
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

          <div className="w-full space-y-4 pt-4">
            <Button 
              className="w-full h-12 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-lg relative overflow-hidden group transition-all"
              onClick={() => {
                window.location.href = "/api/dashboard/auth/login";
              }}
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <SiDiscord className="w-5 h-5 mr-3" />
              Login with Discord
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              Restricted to authorized personnel. All actions are logged.
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs font-mono text-muted-foreground/50 flex items-center gap-2">
        <TerminalSquare className="w-3 h-3" />
        LOWO SYSTEMS INC.
      </div>
    </div>
  );
}
