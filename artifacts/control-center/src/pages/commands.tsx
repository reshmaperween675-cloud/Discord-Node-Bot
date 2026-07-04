import React, { useState } from "react";
import { useListCommands, useGetCommand, useUpdateCommand, useToggleCommand, useGetCommandHistory, getListCommandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BotCommand } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Search, Terminal, SlidersHorizontal, History, Eye, EyeOff, Save, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function CommandsPage() {
  const [search, setSearch] = useState("");
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  
  const { data: commands, isLoading } = useListCommands();

  const filteredCommands = commands?.filter(cmd => 
    cmd.name.toLowerCase().includes(search.toLowerCase()) || 
    cmd.description.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = Array.from(new Set(commands?.map(c => c.category) || []));

  return (
    <div className="p-6 md:p-8 h-full flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Commands</h1>
          <p className="text-muted-foreground font-mono text-sm">Manage bot commands and overrides</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search commands..." 
            className="pl-9 bg-card/50 border-white/10 font-mono text-sm h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <Card key={i} className="bg-card/30 border-white/5 animate-pulse h-32"></Card>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map(category => {
            const categoryCommands = filteredCommands?.filter(c => c.category === category);
            if (!categoryCommands?.length) return null;
            
            return (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-sm font-semibold text-primary uppercase tracking-wider">{category}</h3>
                  <div className="h-[1px] flex-1 bg-border/50"></div>
                  <span className="text-xs font-mono text-muted-foreground">{categoryCommands.length}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {categoryCommands.map(cmd => (
                    <CommandCard 
                      key={cmd.name} 
                      command={cmd} 
                      onClick={() => setSelectedCommand(cmd.name)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          
          {filteredCommands?.length === 0 && (
            <div className="text-center py-20 text-muted-foreground font-mono">
              <Terminal className="w-8 h-8 mx-auto mb-4 opacity-50" />
              NO_COMMANDS_FOUND
            </div>
          )}
        </div>
      )}

      <CommandPanel 
        commandName={selectedCommand} 
        onClose={() => setSelectedCommand(null)} 
      />
    </div>
  );
}

function CommandCard({ command, onClick }: { command: BotCommand, onClick: () => void }) {
  return (
    <Card 
      className={`bg-card/40 border-white/5 backdrop-blur-sm cursor-pointer hover:bg-card/80 hover:border-primary/30 transition-all group ${!command.enabled ? 'opacity-60 grayscale-[0.5]' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
        <div>
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-mono font-bold text-lg text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
              <span className="text-primary/50">{command.isSlash ? '/' : '!'}</span>
              {command.name}
            </h4>
            <div className="flex gap-1.5">
              {command.hidden && <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
              <div className={`w-2 h-2 rounded-full mt-1 ${command.enabled ? 'bg-success' : 'bg-destructive'}`} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {command.overrideDescription || command.description}
          </p>
        </div>
        
        <div className="flex items-center justify-between mt-auto">
          <Badge variant="outline" className="bg-white/5 border-white/10 font-mono text-[10px] rounded">
            {command.type.toUpperCase()}
          </Badge>
          <span className="text-[10px] font-mono text-muted-foreground">
            {command.usageCount?.toLocaleString() || 0} USES
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CommandPanel({ commandName, onClose }: { commandName: string | null, onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: command, isLoading } = useGetCommand(commandName || "", {
    query: { enabled: !!commandName }
  });
  
  const { data: history } = useGetCommandHistory(commandName || "", {
    query: { enabled: !!commandName }
  });

  const updateCmd = useUpdateCommand();
  const toggleCmd = useToggleCommand();

  const [editDesc, setEditDesc] = useState("");
  const [editCooldown, setEditCooldown] = useState<string>("");
  const [editHidden, setEditHidden] = useState(false);

  // Sync state when command loads
  React.useEffect(() => {
    if (command) {
      setEditDesc(command.overrideDescription || command.description);
      setEditCooldown(command.cooldown?.toString() || "");
      setEditHidden(command.hidden || false);
    }
  }, [command]);

  const handleSave = () => {
    if (!commandName) return;
    
    updateCmd.mutate({
      name: commandName,
      data: {
        description: editDesc,
        cooldown: editCooldown ? parseInt(editCooldown, 10) : null,
        hidden: editHidden
      }
    }, {
      onSuccess: () => {
        toast({ title: "Command updated", description: `Successfully updated /${commandName}` });
        queryClient.invalidateQueries({ queryKey: getListCommandsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  const handleToggle = (enabled: boolean) => {
    if (!commandName) return;
    
    toggleCmd.mutate({
      name: commandName,
      data: { enabled }
    }, {
      onSuccess: () => {
        toast({ title: enabled ? "Command enabled" : "Command disabled", description: `/${commandName} is now ${enabled ? 'active' : 'inactive'}` });
        queryClient.invalidateQueries({ queryKey: getListCommandsQueryKey() });
        // Optimistic update for current view
        if (command) {
          queryClient.setQueryData(['/api/dashboard/commands', commandName], { ...command, enabled });
        }
      }
    });
  };

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
              <div className="flex items-center justify-between">
                <SheetTitle className="font-mono text-2xl flex items-center gap-2">
                  <span className="text-primary/50">{command.isSlash ? '/' : '!'}</span>
                  {command.name}
                </SheetTitle>
                <Switch 
                  checked={command.enabled} 
                  onCheckedChange={handleToggle}
                  disabled={toggleCmd.isPending}
                />
              </div>
              <SheetDescription className="font-mono text-xs">
                {command.fileLocation || 'Core System Command'}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              <Tabs defaultValue="settings" className="w-full">
                <TabsList className="w-full rounded-none border-b border-white/10 bg-transparent justify-start h-12 px-6 gap-6">
                  <TabsTrigger value="settings" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 font-mono text-xs h-12">
                    <SlidersHorizontal className="w-3 h-3 mr-2" /> SETTINGS
                  </TabsTrigger>
                  <TabsTrigger value="history" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 font-mono text-xs h-12">
                    <History className="w-3 h-3 mr-2" /> HISTORY
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="settings" className="p-6 space-y-8 outline-none mt-0">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-mono text-muted-foreground uppercase">Description Override</Label>
                      <Textarea 
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        className="bg-black/20 border-white/10 font-mono text-sm resize-none h-24"
                        placeholder={command.description}
                      />
                      <p className="text-[10px] text-muted-foreground">Original: {command.description}</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-mono text-muted-foreground uppercase">Cooldown (Seconds)</Label>
                      <Input 
                        type="number"
                        value={editCooldown}
                        onChange={e => setEditCooldown(e.target.value)}
                        className="bg-black/20 border-white/10 font-mono text-sm"
                        placeholder="Default"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-black/20">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Hide Command</Label>
                        <p className="text-xs text-muted-foreground">Don't show in help menus</p>
                      </div>
                      <Switch 
                        checked={editHidden}
                        onCheckedChange={setEditHidden}
                      />
                    </div>
                  </div>

                  <Button 
                    className="w-full font-mono text-sm" 
                    onClick={handleSave}
                    disabled={updateCmd.isPending || (
                      editDesc === (command.overrideDescription || command.description) &&
                      editCooldown === (command.cooldown?.toString() || "") &&
                      editHidden === (command.hidden || false)
                    )}
                  >
                    {updateCmd.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    SAVE_CHANGES
                  </Button>
                </TabsContent>

                <TabsContent value="history" className="p-6 outline-none mt-0">
                  {!history?.length ? (
                    <div className="text-center py-12 text-muted-foreground font-mono text-sm">
                      NO_HISTORY_RECORDED
                    </div>
                  ) : (
                    <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[1px] before:bg-white/10">
                      {history.map((entry) => (
                        <div key={entry.id} className="relative pl-8">
                          <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-sidebar border-2 border-primary flex items-center justify-center z-10">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          </div>
                          <div className="bg-black/20 border border-white/5 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-mono text-xs text-primary">{entry.changedByUsername}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
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
