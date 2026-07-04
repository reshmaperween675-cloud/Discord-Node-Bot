import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Sparkles, X, Minimize2, Maximize2 } from "lucide-react";
import { useAskAssistant } from "@workspace/api-client-react";

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const askMut = useAskAssistant();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, askMut.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || askMut.isPending) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Provide basic page context
    const context = `Current path: ${window.location.pathname}`;

    askMut.mutate({
      data: { message: userMessage, context }
    }, {
      onSuccess: (res) => {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
      },
      onError: () => {
        setMessages(prev => [...prev, { role: 'assistant', content: 'SYSTEM_ERROR: Failed to reach assistant.' }]);
      }
    });
  };

  if (!isOpen) {
    return (
      <Button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-white z-50 p-0"
      >
        <Sparkles className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className={`fixed right-6 bottom-6 w-80 bg-sidebar/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden transition-all duration-300 ${isMinimized ? 'h-14' : 'h-[500px]'}`}>
      <div className="h-14 shrink-0 border-b border-white/5 bg-black/20 flex items-center justify-between px-4 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-2 text-primary font-mono text-sm font-bold">
          <Bot className="w-5 h-5" />
          LOWO_ASSISTANT
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
            {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="text-center py-10 font-mono text-xs text-muted-foreground space-y-2">
                <Bot className="w-8 h-8 mx-auto opacity-50" />
                <p>AWAITING_INPUT...</p>
                <p className="opacity-50 text-[10px]">I can help you manage commands, configure modules, or check logs.</p>
              </div>
            )}
            
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-black/40 text-muted-foreground border border-white/10'}`}>
                    {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  </div>
                  <div className={`p-3 rounded-lg text-sm max-w-[85%] font-mono ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-black/20 border border-white/5 text-foreground rounded-tl-sm'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {askMut.isPending && (
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-black/40 text-muted-foreground border border-white/10">
                    <Bot className="w-3 h-3" />
                  </div>
                  <div className="p-3 rounded-lg bg-black/20 border border-white/5 rounded-tl-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-75" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-150" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-white/5 bg-black/20 shrink-0">
            <form onSubmit={handleSubmit} className="relative">
              <Input 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask query..."
                className="pr-10 bg-black/40 border-white/10 font-mono text-xs h-10"
                disabled={askMut.isPending}
              />
              <Button 
                type="submit" 
                size="icon" 
                className="absolute right-1 top-1 h-8 w-8 hover:bg-transparent text-muted-foreground hover:text-primary"
                variant="ghost"
                disabled={!input.trim() || askMut.isPending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
