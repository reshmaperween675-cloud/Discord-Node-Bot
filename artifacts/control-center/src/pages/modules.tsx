import React, { useState } from "react";
import { useListModules, useGetModule, useToggleModule, useGetModuleSettings, useUpdateModuleSettings, getListModulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BotModule } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Activity, Terminal, AlertTriangle, Settings2, Loader2, Save, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function ModulesPage() {
  const { data: modules, isLoading } = useListModules();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  return (
    <div className="p-6 md:p-8 h-full flex flex-col gap-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Modules</h1>
        <p className="text-muted-foreground font-mono text-sm">System components and feature groups</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="bg-card/30 border-white/5 animate-pulse h-48"></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {modules?.map((mod: BotModule) => (
            <ModuleCard 
              key={mod.name} 
              module={mod} 
              onClick={() => setSelectedModule(mod.name)}
            />
          ))}
        </div>
      )}

      <ModulePanel 
        moduleName={selectedModule} 
        onClose={() => setSelectedModule(null)} 
      />
    </div>
  );
}

function ModuleCard({ module, onClick }: { module: BotModule, onClick: () => void }) {
  const toggleMut = useToggleModule();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleToggle = (e: React.MouseEvent, enabled: boolean) => {
    e.stopPropagation();
    toggleMut.mutate({
      name: module.name,
      data: { enabled }
    }, {
      onSuccess: () => {
        toast({ title: enabled ? "Module Enabled" : "Module Disabled", description: `${module.displayName} has been ${enabled ? 'activated' : 'deactivated'}.` });
        queryClient.invalidateQueries({ queryKey: getListModulesQueryKey() });
      }
    });
  };

  return (
    <Card 
      className={`bg-card/40 border-white/5 backdrop-blur-sm cursor-pointer hover:bg-card/80 transition-all group overflow-hidden relative ${!module.enabled ? 'opacity-70 grayscale-[0.3]' : ''}`}
      onClick={onClick}
    >
      <div className={`absolute top-0 left-0 w-full h-1 ${module.enabled ? 'bg-primary' : 'bg-muted/30'}`} />
      
      <CardContent className="p-6 flex flex-col h-full justify-between gap-6 pt-8">
        <div>
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-bold text-xl tracking-tight text-foreground group-hover:text-primary transition-colors">
              {module.displayName}
            </h3>
            <Switch 
              checked={module.enabled} 
              onCheckedChange={(c) => handleToggle({ stopPropagation: () => {} } as any, c)}
              disabled={toggleMut.isPending}
            />
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {module.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <div className="bg-black/20 border border-white/5 rounded p-3 flex flex-col items-center justify-center">
            <Terminal className="w-4 h-4 text-muted-foreground mb-1" />
            <span className="font-mono text-lg font-bold">{module.commandCount}</span>
            <span className="text-[10px] text-muted-foreground font-mono uppercase">Commands</span>
          </div>
          <div className={`bg-black/20 border rounded p-3 flex flex-col items-center justify-center ${module.errorCount && module.errorCount > 0 ? 'border-destructive/30 text-destructive' : 'border-white/5 text-foreground'}`}>
            <AlertTriangle className={`w-4 h-4 mb-1 ${module.errorCount && module.errorCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            <span className="font-mono text-lg font-bold">{module.errorCount || 0}</span>
            <span className="text-[10px] font-mono uppercase opacity-70">Errors</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModulePanel({ moduleName, onClose }: { moduleName: string | null, onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: module, isLoading: modLoading } = useGetModule(moduleName || "", {
    query: { enabled: !!moduleName }
  });

  const { data: settingsData, isLoading: setLoading } = useGetModuleSettings(moduleName || "", {
    query: { enabled: !!moduleName }
  });

  const updateSet = useUpdateModuleSettings();
  const [settings, setSettings] = useState<Record<string, any>>({});

  React.useEffect(() => {
    if (settingsData?.settings) {
      setSettings(settingsData.settings);
    }
  }, [settingsData]);

  const handleSaveSettings = () => {
    if (!moduleName) return;
    updateSet.mutate({
      name: moduleName,
      data: { settings }
    }, {
      onSuccess: () => {
        toast({ title: "Settings Saved", description: "Module configuration updated." });
      }
    });
  };

  const handleSettingChange = (key: string, value: string) => {
    // Basic type coercion attempt
    let parsedValue: any = value;
    if (value === "true") parsedValue = true;
    else if (value === "false") parsedValue = false;
    else if (!isNaN(Number(value)) && value !== "") parsedValue = Number(value);

    setSettings(prev => ({ ...prev, [key]: parsedValue }));
  };

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
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${module.enabled ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-muted/20 text-muted-foreground border border-white/10'}`}>
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <SheetTitle className="font-bold text-xl tracking-tight">
                    {module.displayName}
                  </SheetTitle>
                  <div className="text-xs font-mono text-muted-foreground uppercase mt-0.5">
                    ID: {module.name} | CAT: {module.category}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6">
              
              {/* Status Section */}
              <div className="mb-8">
                <h4 className="font-mono text-xs font-semibold text-primary mb-4 flex items-center gap-2">
                  <Power className="w-3 h-3" /> RUNTIME_STATUS
                </h4>
                
                <div className="bg-black/20 border border-white/5 rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-mono text-muted-foreground">STATE</span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${module.enabled ? 'bg-success/20 text-success' : 'bg-muted/20 text-muted-foreground'}`}>
                      {module.enabled ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-mono text-muted-foreground">COMMANDS_MOUNTED</span>
                    <span className="text-xs font-mono text-foreground">{module.commandCount}</span>
                  </div>
                  
                  {module.lastError && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <span className="text-[10px] font-mono text-destructive block mb-1">LAST_ERROR_TRACE:</span>
                      <div className="bg-destructive/10 border border-destructive/20 p-2 rounded text-xs font-mono text-destructive/80 break-words">
                        {module.lastError}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Settings Section */}
              <div>
                <h4 className="font-mono text-xs font-semibold text-primary mb-4 flex items-center gap-2">
                  <Settings2 className="w-3 h-3" /> CONFIGURATION
                </h4>

                {setLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : Object.keys(settings).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground font-mono text-sm border border-white/5 border-dashed rounded-lg bg-black/10">
                    NO_CONFIGURATION_EXPOSED
                  </div>
                ) : (
                  <div className="space-y-4 bg-black/20 border border-white/5 rounded-lg p-4">
                    {Object.entries(settings).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <Label className="text-xs font-mono text-muted-foreground uppercase break-all">{key.replace(/_/g, ' ')}</Label>
                        {typeof value === 'boolean' ? (
                          <div className="flex items-center h-10">
                            <Switch 
                              checked={value} 
                              onCheckedChange={(c) => setSettings(prev => ({ ...prev, [key]: c }))}
                            />
                          </div>
                        ) : (
                          <Input 
                            value={String(value)}
                            onChange={(e) => handleSettingChange(key, e.target.value)}
                            className="bg-black/30 border-white/10 font-mono text-sm h-10"
                          />
                        )}
                      </div>
                    ))}
                    
                    <div className="pt-4 mt-6 border-t border-white/5">
                      <Button 
                        className="w-full font-mono text-sm" 
                        onClick={handleSaveSettings}
                        disabled={updateSet.isPending}
                      >
                        {updateSet.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        WRITE_CONFIG
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
