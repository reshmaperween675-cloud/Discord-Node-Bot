import React, { useState } from "react";
import { useListCommands, useGetCommand, useUpdateCommand, useToggleCommand, useGetCommandHistory, getListCommandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BotCommand } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Terminal, Save, Loader2, History, SlidersHorizontal, EyeOff, Eye } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Category display config — keyed to real category names from the API
const CATEGORY_META: Record<string, { color: string; prefix: string; emoji: string }> = {
  // Slash — system
  "Leveling":            { color: "bg-blue-500/15 text-blue-300 border-blue-500/30",       prefix: "/", emoji: "⭐" },
  "Economy":             { color: "bg-amber-500/15 text-amber-300 border-amber-500/30",     prefix: "/", emoji: "💰" },
  "Moderation":          { color: "bg-orange-500/15 text-orange-300 border-orange-500/30",  prefix: "/", emoji: "🛡️" },
  "Server":              { color: "bg-slate-500/15 text-slate-300 border-slate-500/30",     prefix: "/", emoji: "🏠" },
  "Raids":               { color: "bg-red-500/15 text-red-300 border-red-500/30",           prefix: "/", emoji: "⚔️" },
  "General":             { color: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",        prefix: "/", emoji: "💬" },
  "Lowo Admin":          { color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", prefix: "/", emoji: "👑" },
  // Slash — fun groups
  "Slash Social":        { color: "bg-pink-500/15 text-pink-300 border-pink-500/30",        prefix: "/social ", emoji: "🤗" },
  "Slash Troll":         { color: "bg-red-400/15 text-red-300 border-red-400/30",           prefix: "/troll ",  emoji: "🔥" },
  "Slash Relationship":  { color: "bg-rose-500/15 text-rose-300 border-rose-500/30",        prefix: "/relationship ", emoji: "💘" },
  "Slash Answer":        { color: "bg-violet-500/15 text-violet-300 border-violet-500/30",  prefix: "/answer ", emoji: "🎱" },
  "Slash Meme":          { color: "bg-purple-500/15 text-purple-300 border-purple-500/30",  prefix: "/meme ",  emoji: "😂" },
  "Slash Game":          { color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",  prefix: "/game ",  emoji: "🎮" },
  "Slash LS":            { color: "bg-emerald-600/15 text-emerald-300 border-emerald-600/30", prefix: "/ls ", emoji: "🏴" },
  "Slash Bonus":         { color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",        prefix: "/bonus ", emoji: "✨" },
  // Lowo prefix
  "Lowo Economy":        { color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",  prefix: "lowo ", emoji: "💰" },
  "Lowo Hunt":           { color: "bg-green-500/15 text-green-300 border-green-500/30",     prefix: "lowo ", emoji: "🎯" },
  "Lowo Fishing":        { color: "bg-sky-500/15 text-sky-300 border-sky-500/30",           prefix: "lowo ", emoji: "🎣" },
  "Lowo Mining":         { color: "bg-stone-500/15 text-stone-300 border-stone-500/30",     prefix: "lowo ", emoji: "⛏️" },
  "Lowo Battle":         { color: "bg-red-500/15 text-red-300 border-red-500/30",           prefix: "lowo ", emoji: "⚔️" },
  "Lowo Gear":           { color: "bg-orange-500/15 text-orange-300 border-orange-500/30",  prefix: "lowo ", emoji: "🗡️" },
  "Lowo Pets":           { color: "bg-violet-500/15 text-violet-300 border-violet-500/30",  prefix: "lowo ", emoji: "🐾" },
  "Lowo Gambling":       { color: "bg-amber-600/15 text-amber-300 border-amber-600/30",     prefix: "lowo ", emoji: "🎰" },
  "Lowo Shop":           { color: "bg-teal-500/15 text-teal-300 border-teal-500/30",        prefix: "lowo ", emoji: "🛒" },
  "Lowo Profile":        { color: "bg-blue-500/15 text-blue-300 border-blue-500/30",        prefix: "lowo ", emoji: "👤" },
  "Lowo Quests":         { color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",  prefix: "lowo ", emoji: "📋" },
  "Lowo Market":         { color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", prefix: "lowo ", emoji: "🛒" },
  "Lowo Void":           { color: "bg-gray-800/40 text-gray-300 border-gray-600/30",        prefix: "lowo ", emoji: "🕳️" },
  "Lowo Social":         { color: "bg-pink-500/15 text-pink-300 border-pink-500/30",        prefix: "lowo ", emoji: "💕" },
  "Lowo Emotes":         { color: "bg-rose-400/15 text-rose-300 border-rose-400/30",        prefix: "lowo ", emoji: "😊" },
  "Lowo Actions":        { color: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30", prefix: "lowo ", emoji: "👊" },
  "Lowo Memes":          { color: "bg-lime-500/15 text-lime-300 border-lime-500/30",        prefix: "lowo ", emoji: "📸" },
  "Lowo Minigames":      { color: "bg-cyan-600/15 text-cyan-300 border-cyan-600/30",        prefix: "lowo ", emoji: "🎲" },
  "Lowo Utility":        { color: "bg-slate-400/15 text-slate-300 border-slate-400/30",     prefix: "lowo ", emoji: "🔧" },
  // Mewo prefix
  "Mewo Fun":            { color: "bg-pink-500/15 text-pink-300 border-pink-500/30",        prefix: "mewo ", emoji: "🎉" },
  "Mewo AI":             { color: "bg-violet-500/15 text-violet-300 border-violet-500/30",  prefix: "mewo ", emoji: "🤖" },
  "Mewo Utility":        { color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",  prefix: "mewo ", emoji: "⚙️" },
  "Mewo Games":          { color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",  prefix: "mewo ", emoji: "🎮" },
  "Mewo Roleplay":       { color: "bg-rose-500/15 text-rose-300 border-rose-500/30",        prefix: "mewo ", emoji: "💞" },
  "Mewo Search":         { color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",        prefix: "mewo ", emoji: "🔍" },
  "Mewo Social":         { color: "bg-blue-400/15 text-blue-300 border-blue-400/30",        prefix: "mewo ", emoji: "🕵️" },
  "Mewo Fake":           { color: "bg-purple-400/15 text-purple-300 border-purple-400/30",  prefix: "mewo ", emoji: "🎭" },
  "Mewo Tags":           { color: "bg-teal-500/15 text-teal-300 border-teal-500/30",        prefix: "mewo ", emoji: "🏷️" },
  "Mewo Wallet":         { color: "bg-amber-500/15 text-amber-300 border-amber-500/30",     prefix: "mewo ", emoji: "💰" },
  "Mewo":                { color: "bg-purple-500/15 text-purple-300 border-purple-500/30",  prefix: "mewo ", emoji: "✨" },
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { color: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", prefix: "", emoji: "▪️" };
}

// Group categories into sections for the tab bar
const SLASH_SYSTEM = ["Leveling", "Economy", "Moderation", "Server", "Raids", "General", "Lowo Admin"];
const SLASH_FUN = ["Slash Social", "Slash Troll", "Slash Relationship", "Slash Answer", "Slash Meme", "Slash Game", "Slash LS", "Slash Bonus"];
const LOWO_ALL = ["Lowo Economy", "Lowo Hunt", "Lowo Fishing", "Lowo Mining", "Lowo Battle", "Lowo Gear", "Lowo Pets", "Lowo Gambling", "Lowo Shop", "Lowo Profile", "Lowo Quests", "Lowo Market", "Lowo Void", "Lowo Social", "Lowo Emotes", "Lowo Actions", "Lowo Memes", "Lowo Minigames", "Lowo Utility"];
const MEWO_ALL = ["Mewo Fun", "Mewo AI", "Mewo Utility", "Mewo Games", "Mewo Roleplay", "Mewo Search", "Mewo Social", "Mewo Fake", "Mewo Tags", "Mewo Wallet", "Mewo"];

const TAB_GROUPS: Record<string, string[]> = {
  "All":        [],
  "Slash":      [...SLASH_SYSTEM, ...SLASH_FUN],
  "Slash Fun":  SLASH_FUN,
  "Lowo":       LOWO_ALL,
  "Lowo Social": ["Lowo Social", "Lowo Emotes", "Lowo Actions", "Lowo Memes", "Lowo Minigames"],
  "Mewo":       MEWO_ALL,
  "Mewo AI":    ["Mewo AI"],
};

export default function CommandsPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: commands, isLoading } = useListCommands();

  const filtered = commands?.filter((cmd) => {
    const matchSearch =
      !search ||
      cmd.name.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      tab === "All" ||
      (TAB_GROUPS[tab]?.includes(cmd.category));
    return matchSearch && matchTab;
  });

  const categories = Array.from(new Set(filtered?.map((c) => c.category) ?? []));

  return (
    <div className="p-6 md:p-8 h-full flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Commands</h1>
          <p className="text-muted-foreground text-sm">
            {commands?.length ?? "…"} commands total — click any to edit, toggle, or view history
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search commands…"
            className="pl-9 bg-card/50 border-white/10 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tab filter */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-black/20 border border-white/10 h-10 gap-1 flex-wrap">
          {Object.keys(TAB_GROUPS).map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs font-mono data-[state=active]:bg-primary/20 data-[state=active]:text-primary h-7">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Command grid grouped by category */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="bg-card/30 border border-white/5 rounded-xl h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => {
            const meta = getCategoryMeta(cat);
            const catCmds = filtered?.filter((c) => c.category === cat) ?? [];
            if (!catCmds.length) return null;

            return (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-base">{meta.emoji}</span>
                  <span className="font-bold text-sm text-foreground">{cat}</span>
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-xs font-mono text-muted-foreground">{catCmds.length}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {catCmds.map((cmd) => (
                    <CommandCard
                      key={cmd.name}
                      command={cmd}
                      meta={meta}
                      onClick={() => setSelected(cmd.name)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {!filtered?.length && (
            <div className="text-center py-20 text-muted-foreground">
              <Terminal className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-mono text-sm">No commands found</p>
            </div>
          )}
        </div>
      )}

      <CommandPanel commandName={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function CommandCard({
  command,
  meta,
  onClick,
}: {
  command: BotCommand;
  meta: { color: string; prefix: string; emoji: string };
  onClick: () => void;
}) {
  const displayName = command.name.startsWith("mewo ")
    ? command.name.slice(5)
    : command.name.startsWith("lowo ")
    ? command.name.slice(5)
    : command.name;

  const typeLabel = command.isSlash ? "SLASH" : "PREFIX";
  const prefix = command.isSlash ? "/" : meta.prefix;

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-xl border bg-card/40 backdrop-blur-sm p-4 flex flex-col gap-3 transition-all hover:bg-card/70 hover:border-primary/30",
        command.enabled ? "border-white/10" : "border-white/5 opacity-60 grayscale-[0.4]"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-mono font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
            <span className="text-muted-foreground/60 text-sm">{prefix}</span>
            <span className="truncate">{displayName}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {command.hidden && <EyeOff className="w-3 h-3 text-muted-foreground" />}
          <div className={cn("w-2 h-2 rounded-full", command.enabled ? "bg-emerald-400" : "bg-zinc-600")} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {command.overrideDescription || command.description}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <Badge variant="outline" className={cn("text-[9px] font-mono border px-1.5 h-4", meta.color)}>
          {typeLabel}
        </Badge>
        {(command.usageCount ?? 0) > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {command.usageCount?.toLocaleString()} uses
          </span>
        )}
      </div>
    </div>
  );
}

function CommandPanel({ commandName, onClose }: { commandName: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: command, isLoading } = useGetCommand(commandName ?? "", {
    query: { enabled: !!commandName },
  });
  const { data: history } = useGetCommandHistory(commandName ?? "", {
    query: { enabled: !!commandName },
  });

  const updateCmd = useUpdateCommand();
  const toggleCmd = useToggleCommand();

  const [editDesc, setEditDesc] = useState("");
  const [editCooldown, setEditCooldown] = useState("");
  const [editHidden, setEditHidden] = useState(false);

  React.useEffect(() => {
    if (command) {
      setEditDesc(command.overrideDescription || command.description);
      setEditCooldown(command.cooldown?.toString() ?? "");
      setEditHidden(command.hidden ?? false);
    }
  }, [command]);

  const handleSave = () => {
    if (!commandName) return;
    updateCmd.mutate(
      {
        name: commandName,
        data: {
          description: editDesc,
          cooldown: editCooldown ? parseInt(editCooldown, 10) : null,
          hidden: editHidden,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Command updated" });
          queryClient.invalidateQueries({ queryKey: getListCommandsQueryKey() });
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleToggle = (enabled: boolean) => {
    if (!commandName) return;
    toggleCmd.mutate(
      { name: commandName, data: { enabled } },
      {
        onSuccess: () => {
          toast({ title: enabled ? "Command enabled" : "Command disabled" });
          queryClient.invalidateQueries({ queryKey: getListCommandsQueryKey() });
        },
      }
    );
  };

  const meta = command ? getCategoryMeta(command.category) : null;
  const displayName = commandName ?? "";
  const prefix = command?.isSlash ? "/" : (meta?.prefix ?? "");

  return (
    <Sheet open={!!commandName} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md border-l border-white/10 bg-sidebar/95 backdrop-blur-xl p-0 flex flex-col">
        {isLoading || !command ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <SheetHeader className="p-6 border-b border-white/10 bg-black/20">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <SheetTitle className="font-mono text-xl flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-muted-foreground/60 text-base">{prefix}</span>
                    <span>{displayName.replace(/^(mewo |lowo )/, "")}</span>
                  </SheetTitle>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {meta && (
                      <Badge variant="outline" className={cn("text-[10px] font-mono border px-1.5 h-4", meta.color)}>
                        {command.isSlash ? "SLASH" : "PREFIX"}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">{command.category}</span>
                  </div>
                </div>
                <Switch
                  checked={command.enabled}
                  onCheckedChange={handleToggle}
                  disabled={toggleCmd.isPending}
                />
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              <Tabs defaultValue="settings">
                <TabsList className="w-full rounded-none border-b border-white/10 bg-transparent justify-start h-11 px-6 gap-6">
                  <TabsTrigger value="settings" className="data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 font-mono text-xs h-11 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                    <SlidersHorizontal className="w-3 h-3 mr-1.5" /> Settings
                  </TabsTrigger>
                  <TabsTrigger value="history" className="data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 font-mono text-xs h-11 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                    <History className="w-3 h-3 mr-1.5" /> History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="settings" className="p-6 space-y-6 mt-0 outline-none">
                  {/* Original description */}
                  <div className="text-xs text-muted-foreground bg-black/20 border border-white/5 rounded-lg p-3 font-mono leading-relaxed">
                    <span className="text-primary/60 block mb-1 uppercase text-[10px] tracking-wider">Original</span>
                    {command.description}
                  </div>

                  {/* Override description */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Description Override
                    </Label>
                    <Textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="bg-black/20 border-white/10 resize-none h-24 text-sm"
                      placeholder={command.description}
                    />
                  </div>

                  {/* Cooldown */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Cooldown (seconds)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={editCooldown}
                      onChange={(e) => setEditCooldown(e.target.value)}
                      className="bg-black/20 border-white/10 text-sm"
                      placeholder="None"
                    />
                  </div>

                  {/* Hidden toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-black/20">
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {editHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        Hide from help menus
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Command still works, just hidden</p>
                    </div>
                    <Switch checked={editHidden} onCheckedChange={setEditHidden} />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSave}
                    disabled={
                      updateCmd.isPending ||
                      (editDesc === (command.overrideDescription || command.description) &&
                        editCooldown === (command.cooldown?.toString() ?? "") &&
                        editHidden === (command.hidden ?? false))
                    }
                  >
                    {updateCmd.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>

                  {/* File location */}
                  <div className="text-[10px] font-mono text-muted-foreground/40 text-center">
                    {command.fileLocation}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="p-6 mt-0 outline-none">
                  {!history?.length ? (
                    <div className="text-center py-12 text-muted-foreground font-mono text-sm">
                      No changes recorded yet
                    </div>
                  ) : (
                    <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-white/10">
                      {history.map((entry) => (
                        <div key={entry.id} className="relative pl-8">
                          <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-sidebar border-2 border-primary flex items-center justify-center z-10">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          </div>
                          <div className="bg-black/20 border border-white/5 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-mono text-xs text-primary">{entry.changedByUsername}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs font-mono space-y-1 text-muted-foreground">
                              {Object.entries(entry.after).map(([k, v]) => (
                                <div key={k}>
                                  <span className="opacity-50">{k}:</span> {JSON.stringify(v)}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
