import React, { useState } from "react";
import { useUniversalSearch, BotCommand, BotModule, EmbedEntry, FileSearchResult } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Terminal, Box, Activity, FileCode2, Command } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  
  const { data: results, isLoading } = useUniversalSearch(
    { q: query },
    { query: { enabled: query.length > 1 } }
  );

  return (
    <div className="p-6 md:p-8 h-full flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
        <Input 
          autoFocus
          placeholder="Search commands, embeds, modules, files..." 
          className="pl-14 h-16 text-lg bg-card/60 border-white/10 font-mono shadow-2xl backdrop-blur-xl"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-white/10 bg-black/20 px-2 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {query.length <= 1 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20 opacity-50">
          <Command className="w-16 h-16 mb-4" />
          <span className="font-mono text-sm tracking-widest text-center">GLOBAL_SEARCH_READY<br/>TYPE_TO_QUERY</span>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !results || (results.commands.length === 0 && results.embeds.length === 0 && results.modules.length === 0 && results.files.length === 0) ? (
        <div className="text-center py-20 text-muted-foreground font-mono text-sm">
          NO_RESULTS_FOUND
        </div>
      ) : (
        <div className="space-y-8 overflow-y-auto pb-20">
          
          {results.commands.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5" /> Commands ({results.commands.length})
              </h3>
              <div className="grid gap-2">
                {results.commands.map((cmd: BotCommand) => (
                  <Link key={cmd.name} href="/commands">
                    <Card className="bg-card/40 border-white/5 hover:border-primary/50 hover:bg-card/80 transition-colors cursor-pointer group">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <div className="font-mono font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2 mb-1">
                            <span className="text-primary/50">{cmd.isSlash ? '/' : '!'}</span>{cmd.name}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{cmd.description}</div>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px] bg-black/20 border-white/10">{cmd.category}</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.modules.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> Modules ({results.modules.length})
              </h3>
              <div className="grid gap-2">
                {results.modules.map((mod: BotModule) => (
                  <Link key={mod.name} href="/modules">
                    <Card className="bg-card/40 border-white/5 hover:border-primary/50 hover:bg-card/80 transition-colors cursor-pointer group">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                            {mod.displayName}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{mod.description}</div>
                        </div>
                        <Badge variant={mod.enabled ? "default" : "secondary"} className="font-mono text-[10px]">
                          {mod.enabled ? 'ONLINE' : 'OFFLINE'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.embeds.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                <Box className="w-3.5 h-3.5" /> Embeds ({results.embeds.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {results.embeds.map((embed: EmbedEntry) => (
                  <Link key={embed.id} href="/embeds">
                    <Card className="bg-card/40 border-white/5 hover:border-primary/50 hover:bg-card/80 transition-colors cursor-pointer group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#2b2d31' }} />
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate mb-0.5">
                            {embed.title || embed.id}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground truncate">{embed.module}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.files.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                <FileCode2 className="w-3.5 h-3.5" /> Files ({results.files.length})
              </h3>
              <div className="grid gap-2">
                {results.files.map((file: FileSearchResult, i: number) => (
                  <Link key={i} href="/files">
                    <Card className="bg-card/40 border-white/5 hover:border-primary/50 hover:bg-card/80 transition-colors cursor-pointer group overflow-hidden">
                      <CardContent className="p-0">
                        <div className="px-4 py-2 border-b border-white/5 bg-black/20">
                          <span className="font-mono text-xs text-primary">{file.path}:{file.line}</span>
                        </div>
                        <pre className="p-4 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                          {file.content}
                        </pre>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
