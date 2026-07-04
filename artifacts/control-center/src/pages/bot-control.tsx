import React, { useState } from "react";
import { useGetBotPresence, useSetBotPresence, useBotAction, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Zap, Power, ServerCrash, Skull, Radio, Save, Loader2, Disc } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function BotControlPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: presence, isLoading } = useGetBotPresence();
  const presenceMut = useSetBotPresence();
  const actionMut = useBotAction();

  const [status, setStatus] = useState<string>("online");
  const [actType, setActType] = useState<string>("playing");
  const [actText, setActText] = useState<string>("");

  React.useEffect(() => {
    if (presence) {
      setStatus(presence.status);
      setActType(presence.activityType);
      setActText(presence.activityText);
    }
  }, [presence]);

  const handleSavePresence = () => {
    presenceMut.mutate({
      data: { status, activityType: actType, activityText: actText }
    }, {
      onSuccess: () => {
        toast({ title: "Presence Updated", description: "The bot's status has been synced." });
      }
    });
  };

  const handleAction = (action: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    
    actionMut.mutate({
      data: { action }
    }, {
      onSuccess: (res) => {
        toast({ title: "Action Dispatched", description: res.message || "Command executed successfully." });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Action Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-6 md:p-8 h-full flex flex-col gap-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Bot Control</h1>
        <p className="text-muted-foreground font-mono text-sm">Direct runtime management and presence configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Presence Control */}
        <Card className="bg-card/40 border-white/5 backdrop-blur-sm h-fit">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              PRESENCE_EDITOR
            </CardTitle>
            <CardDescription className="font-mono text-xs">Configure how the bot appears on Discord.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <>
                <div className="space-y-3">
                  <Label className="text-xs font-mono text-muted-foreground">STATUS INDICATOR</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="bg-black/20 border-white/10 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-sidebar border-white/10 font-mono">
                      <SelectItem value="online">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-success"></div> ONLINE</div>
                      </SelectItem>
                      <SelectItem value="idle">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-warning"></div> IDLE</div>
                      </SelectItem>
                      <SelectItem value="dnd">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-destructive"></div> DO NOT DISTURB</div>
                      </SelectItem>
                      <SelectItem value="invisible">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-muted-foreground"></div> INVISIBLE</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-mono text-muted-foreground">ACTIVITY TYPE</Label>
                  <Select value={actType} onValueChange={setActType}>
                    <SelectTrigger className="bg-black/20 border-white/10 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-sidebar border-white/10 font-mono">
                      <SelectItem value="playing">PLAYING</SelectItem>
                      <SelectItem value="watching">WATCHING</SelectItem>
                      <SelectItem value="listening">LISTENING TO</SelectItem>
                      <SelectItem value="competing">COMPETING IN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-mono text-muted-foreground">ACTIVITY TEXT</Label>
                  <Input 
                    value={actText} 
                    onChange={e => setActText(e.target.value)}
                    className="bg-black/20 border-white/10 font-mono"
                    placeholder="e.g. /help for commands"
                  />
                </div>

                <Button 
                  className="w-full font-mono mt-4" 
                  onClick={handleSavePresence}
                  disabled={presenceMut.isPending}
                >
                  {presenceMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  SYNC_PRESENCE
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Action Dispatcher */}
        <Card className="bg-card/40 border-white/5 backdrop-blur-sm h-fit">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <Zap className="w-5 h-5 text-warning" />
              SYSTEM_ACTIONS
            </CardTitle>
            <CardDescription className="font-mono text-xs">Direct runtime directives. Use with caution.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            
            <div className="group border border-white/5 bg-black/20 p-4 rounded-lg flex items-center justify-between hover:border-primary/30 transition-colors">
              <div>
                <h4 className="font-medium text-sm mb-1 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-primary" /> Sync Commands</h4>
                <p className="text-xs text-muted-foreground">Pushes latest slash commands to Discord API.</p>
              </div>
              <Button size="sm" variant="outline" className="border-white/10 hover:bg-primary hover:text-white hover:border-primary" onClick={() => handleAction('sync_commands')}>
                EXECUTE
              </Button>
            </div>

            <div className="group border border-white/5 bg-black/20 p-4 rounded-lg flex items-center justify-between hover:border-warning/30 transition-colors">
              <div>
                <h4 className="font-medium text-sm mb-1 flex items-center gap-2"><Disc className="w-4 h-4 text-warning" /> Clear Cache</h4>
                <p className="text-xs text-muted-foreground">Flushes internal LRU caches (users, roles).</p>
              </div>
              <Button size="sm" variant="outline" className="border-white/10 hover:bg-warning hover:text-white hover:border-warning" onClick={() => handleAction('clear_cache')}>
                EXECUTE
              </Button>
            </div>

            <div className="group border border-white/5 bg-black/20 p-4 rounded-lg flex items-center justify-between hover:border-warning/30 transition-colors">
              <div>
                <h4 className="font-medium text-sm mb-1 flex items-center gap-2"><ServerCrash className="w-4 h-4 text-warning" /> Maintenance Mode</h4>
                <p className="text-xs text-muted-foreground">Blocks all commands except for owners.</p>
              </div>
              <Button size="sm" variant="outline" className="border-white/10 hover:bg-warning hover:text-white hover:border-warning" onClick={() => handleAction('toggle_maintenance', 'Are you sure you want to toggle maintenance mode?')}>
                EXECUTE
              </Button>
            </div>

            <div className="group border border-destructive/20 bg-destructive/5 p-4 rounded-lg flex items-center justify-between hover:border-destructive/50 transition-colors mt-8">
              <div>
                <h4 className="font-medium text-sm mb-1 flex items-center gap-2 text-destructive"><Skull className="w-4 h-4" /> Restart Process</h4>
                <p className="text-xs text-muted-foreground text-destructive/70">Kills the node process. Requires external process manager (PM2/Docker) to recover.</p>
              </div>
              <Button size="sm" variant="destructive" onClick={() => handleAction('restart', 'DANGER: Are you sure you want to kill the bot process?')}>
                RESTART
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
