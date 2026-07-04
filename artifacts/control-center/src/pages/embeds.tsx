import React, { useState } from "react";
import { useListEmbeds, useGetEmbed, useUpdateEmbed, useDeleteEmbed, getListEmbedsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { EmbedEntry } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Box, LayoutTemplate, Plus, Search, Palette, Type, Image as ImageIcon, Trash2, Save, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

// Hex color to integer for Discord API
const hexToInt = (hex: string) => parseInt(hex.replace('#', ''), 16);
const intToHex = (int: number | null | undefined) => int ? `#${int.toString(16).padStart(6, '0')}` : '#2b2d31';

export default function EmbedsPage() {
  const [search, setSearch] = useState("");
  const [selectedEmbed, setSelectedEmbed] = useState<string | null>(null);
  
  const { data: embeds, isLoading } = useListEmbeds();

  const filteredEmbeds = embeds?.filter(e => 
    e.module.toLowerCase().includes(search.toLowerCase()) || 
    (e.title && e.title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 md:p-8 h-full flex flex-col gap-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Embed Library</h1>
          <p className="text-muted-foreground font-mono text-sm">Visual templates for bot messages</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search embeds..." 
              className="pl-9 bg-card/50 border-white/10 font-mono text-sm h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Action button disabled visually since creation isn't in API yet, but UI is requested */}
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 h-10 font-mono text-sm opacity-50 cursor-not-allowed">
            <Plus className="w-4 h-4 mr-2" /> NEW_EMBED
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="bg-card/30 border-white/5 animate-pulse h-64"></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEmbeds?.map(embed => (
            <EmbedCard 
              key={embed.id} 
              embed={embed} 
              onClick={() => setSelectedEmbed(embed.id)}
            />
          ))}
          
          {filteredEmbeds?.length === 0 && (
            <div className="col-span-full text-center py-20 text-muted-foreground font-mono">
              <LayoutTemplate className="w-8 h-8 mx-auto mb-4 opacity-50" />
              NO_EMBEDS_FOUND
            </div>
          )}
        </div>
      )}

      <EmbedEditorPanel 
        embedId={selectedEmbed} 
        onClose={() => setSelectedEmbed(null)} 
      />
    </div>
  );
}

function EmbedCard({ embed, onClick }: { embed: EmbedEntry, onClick: () => void }) {
  const colorHex = intToHex(embed.color);
  
  return (
    <div 
      className="rounded-xl border border-white/10 bg-[#313338] overflow-hidden cursor-pointer hover:ring-2 ring-primary/50 transition-all group flex flex-col h-64"
      onClick={onClick}
    >
      <div className="p-2 bg-black/40 border-b border-white/5 flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground truncate">{embed.module}/{embed.id}</span>
        {embed.isDefault && <span className="text-[9px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-white/70">DEFAULT</span>}
      </div>
      
      <div className="p-4 flex-1 overflow-hidden relative flex">
        <div className="w-1 rounded-sm shrink-0" style={{ backgroundColor: colorHex }} />
        <div className="pl-3 flex-1 min-w-0">
          {embed.title && <h3 className="text-white font-semibold text-sm mb-1 truncate">{embed.title}</h3>}
          {embed.description && <p className="text-[#dbdee1] text-xs line-clamp-4 leading-relaxed">{embed.description}</p>}
          
          {!embed.title && !embed.description && (
            <div className="h-full flex items-center justify-center text-white/20 italic text-xs">No text content</div>
          )}
        </div>
        {embed.thumbnail && (
          <div className="ml-3 shrink-0">
            <img src={embed.thumbnail} alt="" className="w-12 h-12 rounded bg-black/20 object-cover" />
          </div>
        )}
      </div>
      
      <div className="p-3 bg-black/20 border-t border-white/5 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-mono text-primary flex items-center"><Box className="w-3 h-3 mr-1" /> EDIT_TEMPLATE</span>
      </div>
    </div>
  );
}

function EmbedEditorPanel({ embedId, onClose }: { embedId: string | null, onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: embed, isLoading } = useGetEmbed(embedId || "", {
    query: { enabled: !!embedId }
  });

  const updateMut = useUpdateEmbed();
  const deleteMut = useDeleteEmbed();

  const [formData, setFormData] = useState<Partial<EmbedEntry>>({});

  React.useEffect(() => {
    if (embed) {
      setFormData(embed);
    }
  }, [embed]);

  const handleSave = () => {
    if (!embedId) return;
    
    updateMut.mutate({
      id: embedId,
      data: {
        title: formData.title,
        description: formData.description,
        color: formData.color ? formData.color : null,
        footer: formData.footer,
        thumbnail: formData.thumbnail,
        image: formData.image
      }
    }, {
      onSuccess: () => {
        toast({ title: "Embed updated", description: "Changes saved to database." });
        queryClient.invalidateQueries({ queryKey: getListEmbedsQueryKey() });
      }
    });
  };

  const handleDelete = () => {
    if (!embedId) return;
    if (!confirm("Reset to default? Custom overrides will be lost.")) return;
    
    deleteMut.mutate({ id: embedId }, {
      onSuccess: () => {
        toast({ title: "Embed reset", description: "Restored to default template." });
        queryClient.invalidateQueries({ queryKey: getListEmbedsQueryKey() });
        onClose();
      }
    });
  };

  if (!embedId) return null;

  const previewColor = intToHex(formData.color);

  return (
    <Sheet open={!!embedId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-[1000px] sm:w-[90vw] border-l border-white/10 bg-background p-0 flex flex-col md:flex-row overflow-hidden">
        
        {isLoading || !embed ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Editor Sidebar */}
            <div className="w-full md:w-[400px] border-r border-white/10 bg-sidebar/50 flex flex-col h-[50vh] md:h-full overflow-hidden shrink-0">
              <SheetHeader className="p-6 border-b border-white/10 bg-black/20 shrink-0">
                <SheetTitle className="font-mono text-lg flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  EDIT_EMBED
                </SheetTitle>
                <div className="text-xs font-mono text-muted-foreground mt-1">
                  ID: {embed.id}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-mono text-muted-foreground flex items-center gap-2"><Type className="w-3 h-3" /> TITLE</Label>
                    <Input 
                      value={formData.title || ""} 
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      className="bg-black/20 border-white/10 font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-mono text-muted-foreground flex items-center gap-2"><Type className="w-3 h-3" /> DESCRIPTION</Label>
                    <Textarea 
                      value={formData.description || ""} 
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="bg-black/20 border-white/10 font-mono text-sm min-h-[150px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-mono text-muted-foreground flex items-center gap-2"><Palette className="w-3 h-3" /> COLOR (HEX)</Label>
                    <div className="flex gap-2">
                      <div 
                        className="w-10 h-10 rounded border border-white/20 shrink-0"
                        style={{ backgroundColor: previewColor }}
                      />
                      <Input 
                        value={intToHex(formData.color)} 
                        onChange={e => {
                          const val = e.target.value;
                          if (/^#[0-9A-F]{6}$/i.test(val)) {
                            setFormData({...formData, color: hexToInt(val)});
                          }
                        }}
                        className="bg-black/20 border-white/10 font-mono text-sm uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-mono text-muted-foreground flex items-center gap-2"><ImageIcon className="w-3 h-3" /> THUMBNAIL URL</Label>
                    <Input 
                      value={formData.thumbnail || ""} 
                      onChange={e => setFormData({...formData, thumbnail: e.target.value})}
                      className="bg-black/20 border-white/10 font-mono text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-mono text-muted-foreground flex items-center gap-2"><ImageIcon className="w-3 h-3" /> IMAGE URL</Label>
                    <Input 
                      value={formData.image || ""} 
                      onChange={e => setFormData({...formData, image: e.target.value})}
                      className="bg-black/20 border-white/10 font-mono text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-mono text-muted-foreground flex items-center gap-2"><Type className="w-3 h-3" /> FOOTER TEXT</Label>
                    <Input 
                      value={formData.footer || ""} 
                      onChange={e => setFormData({...formData, footer: e.target.value})}
                      className="bg-black/20 border-white/10 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/10 bg-black/20 flex gap-2 shrink-0">
                <Button 
                  className="flex-1 font-mono" 
                  onClick={handleSave}
                  disabled={updateMut.isPending}
                >
                  {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  SAVE
                </Button>
                {!embed.isDefault && (
                  <Button 
                    variant="destructive" 
                    size="icon"
                    onClick={handleDelete}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Live Preview Area */}
            <div className="flex-1 bg-[#2b2d31] p-8 flex items-center justify-center relative h-[50vh] md:h-full overflow-y-auto">
              <div className="absolute top-4 left-4 text-xs font-mono text-white/30 tracking-widest">LIVE_PREVIEW</div>
              
              {/* Discord Message Mockup */}
              <div className="w-full max-w-[520px] flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[#5865F2] shrink-0 mt-1 flex items-center justify-center text-white">
                  <LayoutTemplate className="w-5 h-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-white font-medium text-base">Lowo</span>
                    <span className="bg-[#5865F2] text-white text-[10px] uppercase font-semibold px-1.5 rounded-[3px] leading-4 h-4">BOT</span>
                    <span className="text-[#949ba4] text-xs">Today at 12:00 PM</span>
                  </div>
                  
                  {/* The actual embed preview */}
                  <div className="mt-2 bg-[#2b2d31] border border-white/5 rounded-[4px] flex w-fit max-w-full overflow-hidden shadow-sm">
                    <div className="w-1 shrink-0" style={{ backgroundColor: previewColor }} />
                    <div className="p-4 flex flex-col gap-3 min-w-0 flex-1">
                      
                      <div className="flex gap-4">
                        <div className="flex-1 min-w-0">
                          {formData.title && (
                            <div className="text-white font-semibold text-base mb-2 truncate">
                              {formData.title}
                            </div>
                          )}
                          
                          {formData.description && (
                            <div className="text-[#dbdee1] text-[14px] whitespace-pre-wrap break-words leading-[1.375]">
                              {formData.description}
                            </div>
                          )}
                        </div>
                        
                        {formData.thumbnail && (
                          <div className="shrink-0 w-20 h-20 rounded-[4px] overflow-hidden">
                            <img src={formData.thumbnail} className="w-full h-full object-cover" alt="thumbnail" />
                          </div>
                        )}
                      </div>
                      
                      {formData.image && (
                        <div className="rounded-[4px] overflow-hidden mt-2 max-w-[400px]">
                          <img src={formData.image} className="w-full h-auto object-contain max-h-[300px]" alt="embed image" />
                        </div>
                      )}
                      
                      {formData.footer && (
                        <div className="text-[#dbdee1] text-xs flex items-center mt-2">
                          {formData.footer}
                        </div>
                      )}
                      
                      {!formData.title && !formData.description && !formData.image && !formData.thumbnail && !formData.footer && (
                        <div className="text-[#dbdee1]/50 text-sm italic py-4">Empty embed</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
