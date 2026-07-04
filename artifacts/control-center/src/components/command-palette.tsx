import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useUniversalSearch } from "@workspace/api-client-react";
import { Search, Terminal, Box, Activity, FileCode2 } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  const { data: results, isLoading } = useUniversalSearch(
    { q: query },
    { query: { enabled: query.length > 1 } }
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="bg-card border-b border-border/50">
        <CommandInput 
          placeholder="Type a command or search..." 
          value={query}
          onValueChange={setQuery}
          className="font-mono"
        />
      </div>
      <CommandList className="bg-sidebar/95 backdrop-blur-xl border border-white/5 shadow-2xl">
        <CommandEmpty className="py-6 text-center font-mono text-sm text-muted-foreground">
          {isLoading ? "SEARCHING..." : "NO_RESULTS_FOUND"}
        </CommandEmpty>
        
        {results?.commands && results.commands.length > 0 && (
          <CommandGroup heading="Commands" className="text-muted-foreground font-mono">
            {results.commands.map((cmd) => (
              <CommandItem 
                key={cmd.name}
                onSelect={() => runCommand(() => setLocation("/commands"))}
                className="font-mono flex items-center gap-2 text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-primary cursor-pointer"
              >
                <Terminal className="w-4 h-4 opacity-50" />
                <span><span className="opacity-50">{cmd.isSlash ? '/' : '!'}</span>{cmd.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results?.modules && results.modules.length > 0 && (
          <CommandGroup heading="Modules" className="text-muted-foreground font-mono">
            {results.modules.map((mod) => (
              <CommandItem 
                key={mod.name}
                onSelect={() => runCommand(() => setLocation("/modules"))}
                className="font-mono flex items-center gap-2 text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-primary cursor-pointer"
              >
                <Activity className="w-4 h-4 opacity-50" />
                <span>{mod.displayName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results?.embeds && results.embeds.length > 0 && (
          <CommandGroup heading="Embeds" className="text-muted-foreground font-mono">
            {results.embeds.map((embed) => (
              <CommandItem 
                key={embed.id}
                onSelect={() => runCommand(() => setLocation("/embeds"))}
                className="font-mono flex items-center gap-2 text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-primary cursor-pointer"
              >
                <Box className="w-4 h-4 opacity-50" />
                <span>{embed.title || embed.id}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results?.files && results.files.length > 0 && (
          <CommandGroup heading="Files" className="text-muted-foreground font-mono">
            {results.files.map((file, i) => (
              <CommandItem 
                key={i}
                onSelect={() => runCommand(() => setLocation("/files"))}
                className="font-mono flex items-center gap-2 text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-primary cursor-pointer"
              >
                <FileCode2 className="w-4 h-4 opacity-50" />
                <span>{file.path}:{file.line}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!query && (
          <CommandGroup heading="Navigation" className="text-muted-foreground font-mono">
            <CommandItem onSelect={() => runCommand(() => setLocation("/"))} className="font-mono flex items-center gap-2 cursor-pointer">
              <Search className="w-4 h-4 opacity-50" /> Dashboard
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setLocation("/commands"))} className="font-mono flex items-center gap-2 cursor-pointer">
              <Terminal className="w-4 h-4 opacity-50" /> Commands
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setLocation("/modules"))} className="font-mono flex items-center gap-2 cursor-pointer">
              <Activity className="w-4 h-4 opacity-50" /> Modules
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setLocation("/bot-control"))} className="font-mono flex items-center gap-2 cursor-pointer">
              <Search className="w-4 h-4 opacity-50" /> Bot Control
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
