import React, { useState } from "react";
import { useListModules, useGetModule, useToggleModule, useGetModuleSettings, useUpdateModuleSettings, getListModulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BotModule } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, Settings2, Loader2, Save, Power, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Module visual config — emoji + accent colour per module name
const MODULE_META: Record<string, { emoji: string; accent: string; description?: string }> = {
  "leveling":      { emoji: "⭐", accent: "border-t-blue-500",    description: "XP tracking, level-up rewards and leaderboards" },
  "lowo":          { emoji: "🦁", accent: "border-t-emerald-500", description: "Lowo Zoo RPG — hunting, battling, economy" },
  "mewo":          { emoji: "✨", accent: "border-t-purple-500",  description: "Mewo prefix command suite — fun, AI, games" },
  "economy":       { emoji: "💰", accent: "border-t-yellow-500",  description: "Wallet, balance, transfers and gambling" },
  "moderation":    { emoji: "🛡️", accent: "border-t-orange-500",  description: "Auto-mod, purge, censoring and word filters" },
  "antinuke":      { emoji: "🚨", accent: "border-t-red-500",     description: "Anti-raid, anti-nuke and security monitoring" },
  "activity":      { emoji: "📊", accent: "border-t-sky-500",     description: "Activity tracking, ?activitycheck roster checks" },
  "raids":         { emoji: "⚔️", accent: "border-t-red-600",     description: "Organised raid management and scorekeeping" },
  "training":      { emoji: "🏋️", accent: "border-t-cyan-500",   description: "Training session hosting and MVP tracking" },
  "tournament":    { emoji: "🏆", accent: "border-t-amber-500",   description: "Tournament brackets and participant management" },
  "tickets":       { emoji: "🎫", accent: "border-t-teal-500",    description: "Support ticket flow and staff responses" },
  "verification":  { emoji: "✅", accent: "border-t-green-500",   description: "User verification gate and role assignment" },
  "utility":       { emoji: "🔧", accent: "border-t-slate-400",   description: "General utility slash commands" },
  "welcome":       { emoji: "👋", accent: "border-t-pink-500",    description: "Welcome messages for new members" },
};

function getMeta(name: string) {
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  return MODULE_META[key] ?? { emoji: "▪️", accent: "border-t-zinc-600" };
}

export default function ModulesPage() {
  const { data: modules, isLoading } = useListModules();
  const [selected, setSelected] = useState<string | null>(null);

  const online = modules?.filter((m: BotModule) => m.enabled).length ?? 0;
  const total = modules?.length ?? 0;

  return (
    <div className="p-6 md:p-8 h-full flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Modules</h1>
          <p className="text-muted-foreground text-sm">
            Click any module to configure it or toggle it on/off
          </p>
        </div>
        {!isLoading && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-mono text-muted-foreground">{online}/{total} online</span>
          </div>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-card/30 border border-white/5 rounded-xl h-44 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {modules?.map((mod: BotModule) => (
            <ModuleCard key={mod.name} module={mod} onClick={() => setSelected(mod.name)} />
          ))}
        </div>
      )}

      <ModulePanel moduleName={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ModuleCard({ module, onClick }: { module: BotModule; onClick: () => void }) {
  const toggleMut = useToggleModule();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const meta = getMeta(module.name);

  const handleToggle = (e: React.MouseEvent, enabled: boolean) => {
    e.stopPropagation();
    toggleMut.mutate(
      { name: module.name, data: { enabled } },
      {
        onSuccess: () => {
          toast({ title: enabled ? `${module.displayName} enabled` : `${module.displayName} disabled` });
          queryClient.invalidateQueries({ queryKey: getListModulesQueryKey() });
        },
      }
    );
  };

  const hasErrors = (module.errorCount ?? 0) > 0;

  return (
    <Card
      className={cn(
        "cursor-pointer border-t-2 border-white/10 bg-card/40 backdrop-blur-sm hover:bg-card/70 hover:border-primary/30 transition-all duration-200 group overflow-hidden relative",
        meta.accent,
        !module.enabled && "opacity-60 grayscale-[0.4]"
      )}
      onClick={onClick}
    >
      <CardContent className="p-5 flex flex-col gap-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">{meta.emoji}</span>
            <div>
              <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors">
                {module.displayName}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", module.enabled ? "bg-emerald-400" : "bg-zinc-600")} />
                <span className={cn("text-[11px] font-mono", module.enabled ? "text-emerald-400" : "text-zinc-500")}>
                  {module.enabled ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
            </div>
          </div>
          <Switch
            checked={module.enabled}
            onCheckedChange={(c) => handleToggle({ stopPropagation: () => {} } as React.MouseEvent, c)}
            disabled={toggleMut.isPending}
          />
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {meta.description || module.description}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Terminal className="w-3 h-3" />
            <span className="font-mono">{module.commandCount} cmds</span>
          </div>
          {hasErrors && (
            <div className="flex items-center gap-1.5 text-xs text-destructive ml-auto">
              <AlertTriangle className="w-3 h-3" />
              <span className="font-mono">{module.errorCount} errors</span>
            </div>
          )}
          {!hasErrors && (
            <div className="ml-auto text-[10px] font-mono text-muted-foreground/40">
              Click to configure →
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ModulePanel({ moduleName, onClose }: { moduleName: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: module, isLoading: modLoading } = useGetModule(moduleName ?? "", {
    query: { enabled: !!moduleName },
  });
  const { data: settingsData, isLoading: setLoading } = useGetModuleSettings(moduleName ?? "", {
    query: { enabled: !!moduleName },
  });

  const updateSet = useUpdateModuleSettings();
  const toggleMod = useToggleModule();
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  React.useEffect(() => {
    if (settingsData?.settings) setSettings(settingsData.settings);
  }, [settingsData]);

  const handleSave = () => {
    if (!moduleName) return;
    updateSet.mutate(
      { name: moduleName, data: { settings } },
      {
        onSuccess: () => toast({ title: "Settings saved" }),
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleSettingChange = (key: string, value: string) => {
    let parsed: unknown = value;
    if (value === "true") parsed = true;
    else if (value === "false") parsed = false;
    else if (value !== "" && !isNaN(Number(value))) parsed = Number(value);
    setSettings((prev) => ({ ...prev, [key]: parsed }));
  };

  const meta = moduleName ? getMeta(moduleName) : null;

  return (
    <Sheet open={!!moduleName} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md border-l border-white/10 bg-sidebar/95 backdrop-blur-xl p-0 flex flex-col">
        {modLoading || !module ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <SheetHeader className="p-6 border-b border-white/10 bg-black/20">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-2xl border",
                  module.enabled ? "bg-primary/10 border-primary/30" : "bg-muted/10 border-white/10"
                )}>
                  {meta?.emoji ?? "▪️"}
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="font-bold text-xl">{module.displayName}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-mono border px-1.5 h-4",
                      module.enabled
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                    )}>
                      {module.enabled ? "ONLINE" : "OFFLINE"}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">{module.commandCount} commands</span>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Error trace */}
              {module.lastError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-xs font-mono text-destructive font-semibold uppercase">Last Error</span>
                  </div>
                  <pre className="text-xs font-mono text-destructive/80 break-words whitespace-pre-wrap">
                    {module.lastError}
                  </pre>
                </div>
              )}

              {/* Power toggle */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <Power className="w-3 h-3" /> Power
                </h4>
                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-black/20">
                  <div>
                    <div className="text-sm font-medium">Module active</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {module.enabled ? "All commands in this module are live" : "Module is paused — commands won't respond"}
                    </p>
                  </div>
                  <Switch
                    checked={module.enabled}
                    onCheckedChange={(enabled) => {
                      toggleMod.mutate(
                        { name: module.name, data: { enabled } },
                        { onSuccess: () => { toast({ title: enabled ? "Enabled" : "Disabled" }); queryClient.invalidateQueries({ queryKey: getListModulesQueryKey() }); } }
                      );
                    }}
                  />
                </div>
              </div>

              {/* Settings */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <Settings2 className="w-3 h-3" /> Configuration
                </h4>

                {setLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : Object.keys(settings).length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm border border-white/5 border-dashed rounded-lg bg-black/10">
                    No configurable settings for this module
                  </div>
                ) : (
                  <div className="space-y-4 bg-black/20 border border-white/5 rounded-lg p-4">
                    {Object.entries(settings).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                          {key.replace(/_/g, " ")}
                        </Label>
                        {typeof value === "boolean" ? (
                          <div className="flex items-center h-9">
                            <Switch
                              checked={value}
                              onCheckedChange={(c) => setSettings((prev) => ({ ...prev, [key]: c }))}
                            />
                          </div>
                        ) : (
                          <Input
                            value={String(value)}
                            onChange={(e) => handleSettingChange(key, e.target.value)}
                            className="bg-black/30 border-white/10 font-mono text-sm h-9"
                          />
                        )}
                      </div>
                    ))}

                    <div className="pt-4 border-t border-white/5">
                      <Button className="w-full" onClick={handleSave} disabled={updateSet.isPending}>
                        {updateSet.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Settings
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
