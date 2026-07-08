import React, { useState, useCallback } from "react";
import { useListEmbeds, useGetEmbed, useUpdateEmbed, useDeleteEmbed, getListEmbedsQueryKey, useCreateEmbed, useCreateCustomModule } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { EmbedEntry, EmbedField } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Save, Trash2, Loader2, RotateCcw, Pencil, Zap, Image as ImageIcon, Type, Hash, X, Layers } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const hexToInt = (hex: string) => parseInt(hex.replace("#", ""), 16);
const intToHex = (int: number | null | undefined): string =>
  int != null ? `#${int.toString(16).padStart(6, "0")}` : "#5865f2";

// ─── Trigger info per embed id ────────────────────────────────────────────────
const EMBED_META: Record<string, { trigger: string; description: string }> = {
  "leveling.rank":        { trigger: "/rank",              description: "User checks their XP rank card" },
  "leveling.levelup":     { trigger: "Auto · Level Up",   description: "Bot auto-posts when someone levels up" },
  "leveling.leaderboard": { trigger: "/leaderboard",       description: "User views the XP leaderboard" },
  "utility.warn":         { trigger: "/warn @user",        description: "Moderator issues a warning" },
  "utility.announce":     { trigger: "/announce",          description: "Staff makes an announcement" },
  "utility.poll":         { trigger: "/poll",              description: "Creating a vote/poll" },
  "utility.attendance":   { trigger: "/attendance",        description: "Marking attendance at an event" },
  "raids.start":          { trigger: "/startraid",         description: "A raid is initiated against an opponent" },
  "raids.end":            { trigger: "/endraid",           description: "A raid concludes with results" },
  "training.end":         { trigger: "/training end",      description: "Training session wraps up" },
  "tournament.open":      { trigger: "/tournament",        description: "Tournament bracket opens" },
  "lowo.hunt":            { trigger: "lowo hunt",          description: "User hunts for animals" },
  "lowo.battle":          { trigger: "lowo battle",        description: "User challenges another to battle" },
  "lowo.profile":         { trigger: "lowo profile",       description: "User views their lowo profile" },
  "lowo.slots":           { trigger: "lowo slots",         description: "User plays the slot machine" },
  "mewo.ai":              { trigger: "mewo chatgpt / llama", description: "AI command response" },
  "mewo.help":            { trigger: "mewo help",          description: "Mewo help panel" },
  "antinuke.alert":       { trigger: "Auto · Anti-Nuke",  description: "Security system detects suspicious activity" },
  "verification.success": { trigger: "Auto · Verify",     description: "User completes verification" },
  "economy.balance":      { trigger: "/balance",           description: "User checks their economy balance" },
};

// ─── Preview placeholder substitutions (makes the preview look realistic) ────
const PREVIEW: Record<string, string> = {
  "{user}": "@Username",
  "{username}": "Username",
  "{user1}": "@Challenger",
  "{user2}": "@Opponent",
  "{level}": "12",
  "{xp}": "1,234",
  "{nextXp}": "2,000",
  "{rank}": "#3",
  "{balance}": "5,420",
  "{wallet}": "1,200",
  "{bank}": "4,220",
  "{total}": "5,420",
  "{server}": "Last Stand",
  "{moderator}": "@Mod",
  "{reason}": "Breaking server rules",
  "{count}": "47",
  "{animals}": "🦁 Lion  🐯 Tiger  🐻 Bear",
  "{host}": "@HostUser",
  "{duration}": "45 minutes",
  "{mvp}": "@BestPlayer",
  "{result}": "Victory 🏆",
  "{opponent}": "Enemy Guild",
  "{number}": "42",
  "{performers}": "@Player1, @Player2",
  "{author}": "@Author",
  "{content}": "Important server announcement goes here.",
  "{question}": "What is your favourite colour?",
  "{event}": "Weekly Meeting",
  "{date}": "July 15, 2026",
  "{prize}": "100 Robux",
  "{max}": "32",
  "{about}": "Summer Tournament",
  "{rules}": "No teaming. Best of 3 rounds wins.",
  "{response}": "Here is the AI response to your question...",
  "{model}": "GPT-4o",
  "{page}": "1",
  "{action}": "Mass Ban",
  "{threshold}": "5",
  "{payout}": "1,500",
  "{wager}": "500",
  "{winner}": "@Winner",
};

function applyPreview(text: string | null | undefined): string {
  if (!text) return "";
  return Object.entries(PREVIEW).reduce(
    (s, [k, v]) => s.replaceAll(k, v),
    text
  );
}

// ─── Variable chips users can click to insert ────────────────────────────────
const VARIABLE_GROUPS = [
  { label: "User", vars: ["{user}", "{username}", "{user1}", "{user2}"] },
  { label: "Leveling", vars: ["{level}", "{xp}", "{nextXp}", "{rank}"] },
  { label: "Economy", vars: ["{balance}", "{wallet}", "{bank}", "{total}"] },
  { label: "Lowo", vars: ["{animals}", "{count}", "{winner}"] },
  { label: "Events", vars: ["{host}", "{duration}", "{mvp}", "{result}", "{opponent}", "{prize}"] },
  { label: "Mod", vars: ["{moderator}", "{reason}", "{action}"] },
  { label: "Other", vars: ["{server}", "{author}", "{page}", "{content}", "{response}", "{model}"] },
];

// ─── Module groups for filter tabs ───────────────────────────────────────────
const MODULE_TABS = ["All", "Lowo", "Leveling", "Economy", "Mewo", "Utility", "Raids", "Moderation", "Other"];
const MODULE_COLORS: Record<string, string> = {
  Lowo:         "text-emerald-400",
  Leveling:     "text-blue-400",
  Economy:      "text-yellow-400",
  Mewo:         "text-purple-400",
  Utility:      "text-sky-400",
  Raids:        "text-red-400",
  "Anti-Nuke":  "text-red-400",
  Moderation:   "text-orange-400",
  Tournaments:  "text-yellow-400",
  Training:     "text-cyan-400",
  Verification: "text-green-400",
};

function getModuleTab(module: string): string {
  if (["Lowo"].includes(module)) return "Lowo";
  if (["Leveling"].includes(module)) return "Leveling";
  if (["Economy"].includes(module)) return "Economy";
  if (["Mewo"].includes(module)) return "Mewo";
  if (["Utility"].includes(module)) return "Utility";
  if (["Raids"].includes(module)) return "Raids";
  if (["Moderation", "Anti-Nuke"].includes(module)) return "Moderation";
  return "Other";
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmbedsPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewEmbed, setShowNewEmbed] = useState(false);
  const [showNewModule, setShowNewModule] = useState(false);

  const { data: embeds, isLoading } = useListEmbeds();

  const filtered = embeds?.filter((e) => {
    const matchSearch =
      !search ||
      e.module.toLowerCase().includes(search.toLowerCase()) ||
      (e.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
      e.id.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === "All" || getModuleTab(e.module) === tab;
    return matchSearch && matchTab;
  });

  // group by module
  const groups = filtered
    ? Array.from(new Set(filtered.map((e) => e.module))).map((mod) => ({
        module: mod,
        embeds: filtered.filter((e) => e.module === mod),
      }))
    : [];

  return (
    <div className="p-6 md:p-8 h-full flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Embed Library</h1>
          <p className="text-muted-foreground text-sm">
            Click any embed to edit what users see in Discord — with live preview.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search embeds…"
              className="pl-9 bg-card/50 border-white/10 h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="border-white/10 h-10 gap-1.5 shrink-0" onClick={() => setShowNewModule(true)}>
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">New Module</span>
          </Button>
          <Button size="sm" className="h-10 gap-1.5 shrink-0" onClick={() => setShowNewEmbed(true)}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Embed</span>
          </Button>
        </div>
      </div>

      {/* Module filter tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-black/20 border border-white/10 h-10 gap-1 flex-wrap">
          {MODULE_TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs font-mono data-[state=active]:bg-primary/20 data-[state=active]:text-primary h-7">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-[#313338] border border-white/5 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 py-20">
          <Hash className="w-10 h-10 opacity-30" />
          <p className="font-mono text-sm">No embeds found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ module, embeds: groupEmbeds }) => (
            <div key={module}>
              <div className="flex items-center gap-3 mb-4">
                <span className={cn("font-bold text-base", MODULE_COLORS[module] ?? "text-foreground")}>
                  {module}
                </span>
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-xs font-mono text-muted-foreground">{groupEmbeds.length} embed{groupEmbeds.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupEmbeds.map((embed) => (
                  <EmbedPreviewCard
                    key={embed.id}
                    embed={embed}
                    onClick={() => setSelectedId(embed.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <EmbedEditorDialog
        embedId={selectedId}
        onClose={() => setSelectedId(null)}
      />

      {/* New embed dialog */}
      <NewEmbedDialog
        open={showNewEmbed}
        onClose={() => setShowNewEmbed(false)}
        existingModules={Array.from(new Set(embeds?.map((e) => e.module) ?? []))}
        onCreated={(id) => { setShowNewEmbed(false); setSelectedId(id); }}
      />

      {/* New module dialog */}
      <NewModuleDialog
        open={showNewModule}
        onClose={() => setShowNewModule(false)}
      />
    </div>
  );
}

// ─── Discord-style preview card ───────────────────────────────────────────────
function EmbedPreviewCard({ embed, onClick }: { embed: EmbedEntry; onClick: () => void }) {
  const colorHex = intToHex(embed.color);
  const meta = EMBED_META[embed.id];
  const isModified = !embed.isDefault;

  return (
    <div
      className="group cursor-pointer rounded-xl border border-white/10 bg-[#2b2d31] overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 flex flex-col"
      onClick={onClick}
    >
      {/* Card header */}
      <div className="px-4 pt-3 pb-2 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-muted-foreground truncate">{embed.id}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isModified && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] font-mono h-4 px-1.5">CUSTOM</Badge>
          )}
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Trigger label */}
      {meta && (
        <div className="px-4 py-2 bg-black/20 border-b border-white/5">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
            <span className="text-muted-foreground">Used when:</span>
            <code className="text-yellow-300 font-mono">{meta.trigger}</code>
          </div>
        </div>
      )}

      {/* Discord message mockup */}
      <div className="p-4 flex gap-3 flex-1 min-h-0">
        {/* Bot avatar */}
        <div className="w-9 h-9 rounded-full bg-[#5865f2] shrink-0 flex items-center justify-center text-white font-bold text-sm mt-0.5">
          L
        </div>

        <div className="flex-1 min-w-0">
          {/* Username row */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-white font-semibold text-sm">Lowo</span>
            <span className="bg-[#5865F2] text-white text-[9px] uppercase font-bold px-1.5 rounded-[3px] leading-4">BOT</span>
            <span className="text-[#949ba4] text-[11px]">Today at 12:00</span>
          </div>

          {/* Embed */}
          <div className="rounded-[4px] overflow-hidden border border-white/5 bg-[#2b2d31] flex max-w-full">
            <div className="w-1 shrink-0" style={{ backgroundColor: colorHex }} />
            <div className="p-3 flex-1 min-w-0 space-y-1.5">
              {embed.title && (
                <div className="text-white font-semibold text-sm leading-tight truncate">
                  {applyPreview(embed.title)}
                </div>
              )}
              {embed.description && (
                <div className="text-[#dbdee1] text-xs leading-relaxed line-clamp-3">
                  {applyPreview(embed.description)}
                </div>
              )}
              {!embed.title && !embed.description && embed.fields && embed.fields.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {embed.fields.slice(0, 2).map((f, i) => (
                    <div key={i}>
                      <div className="text-white text-[11px] font-semibold">{f.name}</div>
                      <div className="text-[#dbdee1] text-[11px]">{applyPreview(f.value)}</div>
                    </div>
                  ))}
                </div>
              )}
              {embed.fields && embed.fields.length > 0 && (embed.title || embed.description) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                  {embed.fields.slice(0, 2).map((f, i) => (
                    <div key={i} className={f.inline ? "" : "col-span-2"}>
                      <div className="text-white text-[10px] font-semibold">{f.name}</div>
                      <div className="text-[#dbdee1] text-[10px]">{applyPreview(f.value)}</div>
                    </div>
                  ))}
                  {embed.fields.length > 2 && (
                    <div className="col-span-2 text-[9px] text-muted-foreground">+{embed.fields.length - 2} more fields</div>
                  )}
                </div>
              )}
            </div>
            {embed.thumbnail && (
              <img src={embed.thumbnail} className="w-14 h-14 object-cover rounded m-2 shrink-0" alt="thumbnail" />
            )}
          </div>
        </div>
      </div>

      {/* Hover action */}
      <div className="px-4 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-[11px] text-primary font-medium flex items-center gap-1.5">
          <Pencil className="w-3 h-3" />
          Click to edit with live preview
        </div>
      </div>
    </div>
  );
}

// ─── Full-screen editor dialog ────────────────────────────────────────────────
function EmbedEditorDialog({ embedId, onClose }: { embedId: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: embed, isLoading } = useGetEmbed(embedId ?? "", {
    query: { enabled: !!embedId },
  });

  const updateMut = useUpdateEmbed();
  const deleteMut = useDeleteEmbed();

  const [form, setForm] = useState<Partial<EmbedEntry>>({});
  const [activeField, setActiveField] = useState<"title" | "description" | "footer" | null>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const descRef = React.useRef<HTMLTextAreaElement>(null);
  const footerRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (embed) setForm({ ...embed });
  }, [embed]);

  const insertVar = useCallback((v: string) => {
    if (activeField === "title") {
      const el = titleRef.current;
      if (!el) return;
      const start = el.selectionStart ?? (form.title ?? "").length;
      const end = el.selectionEnd ?? start;
      const current = form.title ?? "";
      const next = current.slice(0, start) + v + current.slice(end);
      setForm((f) => ({ ...f, title: next }));
      setTimeout(() => { el.setSelectionRange(start + v.length, start + v.length); el.focus(); }, 0);
    } else if (activeField === "footer") {
      const el = footerRef.current;
      if (!el) return;
      const start = el.selectionStart ?? (form.footer ?? "").length;
      const end = el.selectionEnd ?? start;
      const current = form.footer ?? "";
      const next = current.slice(0, start) + v + current.slice(end);
      setForm((f) => ({ ...f, footer: next }));
      setTimeout(() => { el.setSelectionRange(start + v.length, start + v.length); el.focus(); }, 0);
    } else {
      // default to description
      const el = descRef.current;
      if (!el) return;
      const start = el.selectionStart ?? (form.description ?? "").length;
      const end = el.selectionEnd ?? start;
      const current = form.description ?? "";
      const next = current.slice(0, start) + v + current.slice(end);
      setForm((f) => ({ ...f, description: next }));
      setTimeout(() => { el.setSelectionRange(start + v.length, start + v.length); el.focus(); }, 0);
    }
  }, [activeField, form]);

  const handleSave = () => {
    if (!embedId) return;
    updateMut.mutate(
      { id: embedId, data: { title: form.title, description: form.description, color: form.color ?? null, footer: form.footer, thumbnail: form.thumbnail, image: form.image, fields: form.fields ?? [] } },
      {
        onSuccess: () => {
          toast({ title: "✅ Embed saved", description: "Changes are now live." });
          queryClient.invalidateQueries({ queryKey: getListEmbedsQueryKey() });
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleReset = () => {
    if (!embedId) return;
    if (!confirm("Reset to default? Your customizations will be lost.")) return;
    deleteMut.mutate(
      { id: embedId },
      {
        onSuccess: () => {
          toast({ title: "Embed reset", description: "Restored to default." });
          queryClient.invalidateQueries({ queryKey: getListEmbedsQueryKey() });
          onClose();
        },
      }
    );
  };

  const colorHex = intToHex(form.color);
  const meta = embedId ? EMBED_META[embedId] : null;
  const isModified = embed && !embed.isDefault;

  return (
    <Dialog open={!!embedId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 bg-background border-white/10 flex flex-col overflow-hidden">
        {isLoading || !embed ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 min-h-0">

            {/* ── Left: Editor ───────────────────────────────────────── */}
            <div className="w-full md:w-[420px] shrink-0 border-r border-white/10 flex flex-col h-[50vh] md:h-full">
              {/* Header */}
              <div className="p-5 border-b border-white/10 bg-black/20 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-lg leading-tight">{embed.module} — {embed.id.split(".")[1]}</h2>
                    {meta && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        <code className="text-yellow-300">{meta.trigger}</code>
                        <span>·</span>
                        <span>{meta.description}</span>
                      </div>
                    )}
                  </div>
                  {isModified && <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] shrink-0">CUSTOM</Badge>}
                </div>
              </div>

              {/* Form */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Title */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <Type className="w-3 h-3" /> Title
                  </Label>
                  <Input
                    ref={titleRef}
                    value={form.title ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    onFocus={() => setActiveField("title")}
                    className="bg-black/20 border-white/10"
                    placeholder="Embed title…"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <Type className="w-3 h-3" /> Description
                  </Label>
                  <Textarea
                    ref={descRef}
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    onFocus={() => setActiveField("description")}
                    className="bg-black/20 border-white/10 min-h-[120px] resize-none font-mono text-sm"
                    placeholder="Embed description… Use {user}, {level}, etc."
                  />
                </div>

                {/* Variable chips */}
                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Hash className="w-3 h-3" /> Variables
                    <span className="normal-case font-normal text-[11px]">— click to insert into {activeField ?? "description"}</span>
                  </Label>
                  <div className="space-y-2.5">
                    {VARIABLE_GROUPS.map((group) => (
                      <div key={group.label}>
                        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase mb-1 block">{group.label}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {group.vars.map((v) => (
                            <button
                              key={v}
                              onClick={() => insertVar(v)}
                              className="text-[11px] font-mono px-2 py-0.5 rounded border border-white/10 bg-black/20 hover:bg-primary/20 hover:border-primary/40 hover:text-primary text-muted-foreground transition-all"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sidebar Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={colorHex}
                      onChange={(e) => setForm((f) => ({ ...f, color: hexToInt(e.target.value) }))}
                      className="w-10 h-10 rounded border border-white/20 bg-transparent cursor-pointer"
                    />
                    <Input
                      value={colorHex.toUpperCase()}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9A-Fa-f]{6}$/.test(v)) setForm((f) => ({ ...f, color: hexToInt(v) }));
                      }}
                      className="bg-black/20 border-white/10 font-mono text-sm uppercase flex-1"
                      placeholder="#5865F2"
                    />
                  </div>
                </div>

                {/* Thumbnail & Image */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" /> Thumbnail URL
                  </Label>
                  <Input
                    value={form.thumbnail ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnail: e.target.value || undefined }))}
                    className="bg-black/20 border-white/10 text-sm"
                    placeholder="https://… (small image, top-right)"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" /> Large Image URL
                  </Label>
                  <Input
                    value={form.image ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, image: e.target.value || undefined }))}
                    className="bg-black/20 border-white/10 text-sm"
                    placeholder="https://… (full-width image)"
                  />
                </div>

                {/* Footer */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Footer Text</Label>
                  <Input
                    ref={footerRef}
                    value={form.footer ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, footer: e.target.value || undefined }))}
                    onFocus={() => setActiveField("footer")}
                    className="bg-black/20 border-white/10 text-sm"
                    placeholder="Footer text…"
                  />
                </div>

                {/* Fields */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Hash className="w-3 h-3" /> Fields ({form.fields?.length ?? 0}/25)
                    </Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs border-white/10"
                      onClick={() => setForm((f) => ({ ...f, fields: [...(f.fields ?? []), { name: "", value: "", inline: true }] }))}
                      disabled={(form.fields?.length ?? 0) >= 25}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  {(form.fields ?? []).length === 0 && (
                    <div className="text-[11px] text-muted-foreground/40 italic text-center py-2 border border-white/5 rounded">
                      No fields — click Add to create one
                    </div>
                  )}
                  <div className="space-y-2">
                    {(form.fields ?? []).map((field: EmbedField, idx: number) => (
                      <div key={idx} className="border border-white/10 rounded-lg p-3 bg-black/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted-foreground">Field {idx + 1}</span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={field.inline}
                                onChange={(e) => {
                                  const next = [...(form.fields ?? [])];
                                  next[idx] = { ...field, inline: e.target.checked };
                                  setForm((f) => ({ ...f, fields: next }));
                                }}
                                className="w-3 h-3"
                              />
                              <span className="text-[11px] text-muted-foreground">Inline</span>
                            </label>
                            <button
                              onClick={() => {
                                const next = (form.fields ?? []).filter((_: EmbedField, i: number) => i !== idx);
                                setForm((f) => ({ ...f, fields: next }));
                              }}
                              className="text-destructive/60 hover:text-destructive transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <Input
                          value={field.name}
                          onChange={(e) => {
                            const next = [...(form.fields ?? [])];
                            next[idx] = { ...field, name: e.target.value };
                            setForm((f) => ({ ...f, fields: next }));
                          }}
                          placeholder="Field name…"
                          className="bg-black/20 border-white/10 text-xs h-7"
                        />
                        <Textarea
                          value={field.value}
                          onChange={(e) => {
                            const next = [...(form.fields ?? [])];
                            next[idx] = { ...field, value: e.target.value };
                            setForm((f) => ({ ...f, fields: next }));
                          }}
                          placeholder="Field value…"
                          className="bg-black/20 border-white/10 text-xs min-h-[52px] resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-white/10 bg-black/20 flex gap-2 shrink-0">
                <Button className="flex-1" onClick={handleSave} disabled={updateMut.isPending}>
                  {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
                {isModified && (
                  <Button variant="outline" className="border-white/10" onClick={handleReset} disabled={deleteMut.isPending}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* ── Right: Live Preview ─────────────────────────────────── */}
            <div className="flex-1 bg-[#313338] flex flex-col overflow-auto h-[40vh] md:h-full">
              {/* Preview label */}
              <div className="px-6 pt-4 pb-2 flex items-center gap-3 border-b border-white/5 shrink-0">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-mono text-white/40 tracking-widest uppercase">Live Preview</span>
                <span className="text-xs text-muted-foreground ml-auto">Looks exactly like Discord</span>
              </div>

              {/* Discord message */}
              <div className="flex-1 p-6 overflow-auto">
                <div className="flex gap-3 max-w-[520px]">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#5865f2] shrink-0 flex items-center justify-center text-white font-bold text-base mt-0.5">
                    L
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Username */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">Lowo</span>
                      <span className="bg-[#5865F2] text-white text-[10px] uppercase font-bold px-1.5 rounded-[3px] leading-4 h-4 flex items-center">BOT</span>
                      <span className="text-[#949ba4] text-xs">Today at 12:00 PM</span>
                    </div>

                    {/* Embed */}
                    <div className="mt-1 rounded-[4px] overflow-hidden border border-white/5 flex bg-[#2b2d31] w-fit max-w-full">
                      <div className="w-1 shrink-0" style={{ backgroundColor: colorHex }} />
                      <div className="flex-1 min-w-0">
                        <div className="p-4 space-y-2">
                          {/* Title & thumbnail row */}
                          <div className="flex gap-4">
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {form.title && (
                                <div className="text-white font-semibold text-base leading-snug">
                                  {applyPreview(form.title)}
                                </div>
                              )}
                              {form.description && (
                                <div className="text-[#dbdee1] text-sm whitespace-pre-wrap break-words leading-[1.375]">
                                  {applyPreview(form.description)}
                                </div>
                              )}
                            </div>
                            {form.thumbnail && (
                              <img
                                src={form.thumbnail}
                                className="w-20 h-20 rounded-[4px] object-cover shrink-0"
                                alt="thumbnail"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                          </div>

                          {/* Fields */}
                          {(form.fields ?? []).length > 0 && (
                            <div className="grid grid-cols-3 gap-x-4 gap-y-3 pt-1">
                              {(form.fields ?? []).map((f: EmbedField, i: number) => (
                                <div key={i} className={f.inline ? "" : "col-span-3"}>
                                  <div className="text-white text-sm font-semibold mb-0.5">{applyPreview(f.name)}</div>
                                  <div className="text-[#dbdee1] text-sm">{applyPreview(f.value)}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Large image */}
                          {form.image && (
                            <div className="rounded-[4px] overflow-hidden mt-2 max-w-[420px]">
                              <img
                                src={form.image}
                                className="w-full h-auto object-contain max-h-[240px]"
                                alt="embed image"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            </div>
                          )}

                          {/* Footer */}
                          {form.footer && (
                            <div className="text-[#949ba4] text-xs pt-1 border-t border-white/5 mt-2">
                              {applyPreview(form.footer)}
                            </div>
                          )}

                          {/* Empty state */}
                          {!form.title && !form.description && !form.image && !form.footer && !(form.fields?.length) && (
                            <div className="text-[#dbdee1]/30 text-sm italic py-6 text-center">
                              Start typing to see your embed preview
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── New Embed Dialog ─────────────────────────────────────────────────────────
function NewEmbedDialog({
  open,
  onClose,
  existingModules,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  existingModules: string[];
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const createMut = useCreateEmbed();
  const [form, setForm] = useState({
    id: "",
    module: "",
    customModule: "",
    title: "",
    description: "",
    color: 0x5865f2,
    footer: "",
  });
  const [useCustomModule, setUseCustomModule] = useState(false);

  const handleCreate = () => {
    const rawId = form.id.trim();
    const module = useCustomModule ? form.customModule.trim() : form.module;
    if (!rawId || !module) {
      toast({ title: "Required", description: "ID and module are required.", variant: "destructive" });
      return;
    }
    const finalId = rawId.startsWith("custom.") ? rawId : `custom.${rawId}`;
    createMut.mutate(
      {
        id: rawId,
        module,
        title: form.title || null,
        description: form.description || null,
        color: form.color,
        footer: form.footer || null,
      },
      {
        onSuccess: () => {
          toast({ title: "✅ Embed created", description: `${finalId} is ready to edit.` });
          setForm({ id: "", module: "", customModule: "", title: "", description: "", color: 0x5865f2, footer: "" });
          setUseCustomModule(false);
          onCreated(finalId);
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const allModules = Array.from(new Set([...existingModules, "Custom"]));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[500px] max-w-[95vw] bg-background border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            New Custom Embed
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Embed ID *</Label>
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-muted-foreground px-2 py-2 bg-black/30 rounded-l border border-white/10 border-r-0">custom.</span>
              <Input
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") }))}
                placeholder="my-embed"
                className="bg-black/20 border-white/10 font-mono text-sm rounded-l-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground/60">Lowercase letters, numbers, dots, and dashes only.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Module *</Label>
            {useCustomModule ? (
              <div className="flex gap-2">
                <Input
                  value={form.customModule}
                  onChange={(e) => setForm((f) => ({ ...f, customModule: e.target.value }))}
                  placeholder="Module name…"
                  className="bg-black/20 border-white/10 text-sm"
                  autoFocus
                />
                <Button size="sm" variant="outline" className="border-white/10 shrink-0" onClick={() => setUseCustomModule(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={form.module} onValueChange={(v) => setForm((f) => ({ ...f, module: v }))}>
                  <SelectTrigger className="bg-black/20 border-white/10 text-sm">
                    <SelectValue placeholder="Select module…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allModules.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="border-white/10 shrink-0 text-xs" onClick={() => setUseCustomModule(true)}>
                  New
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Embed title…"
              className="bg-black/20 border-white/10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Embed description…"
              className="bg-black/20 border-white/10 text-sm min-h-[80px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sidebar Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={intToHex(form.color)}
                onChange={(e) => setForm((f) => ({ ...f, color: hexToInt(e.target.value) }))}
                className="w-9 h-9 rounded border border-white/20 bg-transparent cursor-pointer"
              />
              <Input
                value={intToHex(form.color).toUpperCase()}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setForm((f) => ({ ...f, color: hexToInt(e.target.value) }));
                }}
                className="bg-black/20 border-white/10 font-mono text-sm"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="border-white/10" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={createMut.isPending}>
            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Embed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Module Dialog ────────────────────────────────────────────────────────
function NewModuleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const createMut = useCreateCustomModule();
  const [name, setName] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    createMut.mutate(name.trim(), {
      onSuccess: () => {
        toast({ title: "✅ Module created", description: `"${name.trim()}" is now available when creating embeds.` });
        setName("");
        onClose();
      },
      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[400px] max-w-[95vw] bg-background border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            New Module
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Create a new module group to organise custom embeds under.
          </p>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Module Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Events, Logging, Tickets…"
              className="bg-black/20 border-white/10"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="border-white/10" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={createMut.isPending || !name.trim()}>
            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
            Create Module
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
