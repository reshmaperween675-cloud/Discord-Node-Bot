import React, { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, User, Clock, ArrowRight, Activity, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuditLogsPage() {
  const [page, setPage] = useState(0);
  const limit = 30;
  
  const { data: logs, isLoading } = useListAuditLogs(
    { limit, offset: page * limit },
    { query: {} }
  );

  return (
    <div className="p-6 md:p-8 h-full flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-primary" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground font-mono text-sm">Immutable record of dashboard actions</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="border-white/10 font-mono text-xs bg-card/40"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || isLoading}
          >
            NEWER
          </Button>
          <Button 
            variant="outline" 
            className="border-white/10 font-mono text-xs bg-card/40"
            onClick={() => setPage(p => p + 1)}
            disabled={!logs || logs.length < limit || isLoading}
          >
            OLDER
          </Button>
        </div>
      </div>

      {isLoading && page === 0 ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-card/20 border-white/5 animate-pulse h-24"></Card>
          ))}
        </div>
      ) : logs?.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20">
          <ShieldAlert className="w-16 h-16 mb-4 opacity-20" />
          <span className="font-mono text-sm">NO_LOGS_FOUND</span>
        </div>
      ) : (
        <div className="relative before:absolute before:inset-y-0 before:left-[19px] before:w-[2px] before:bg-white/5 space-y-6">
          {logs?.map((log) => (
            <div key={log.id} className="relative pl-12 group">
              {/* Timeline dot */}
              <div className="absolute left-0 top-6 w-10 h-10 -mt-5 rounded-full bg-background border-4 border-sidebar flex items-center justify-center z-10 group-hover:border-primary/30 transition-colors">
                <div className={`w-3 h-3 rounded-full ${log.action.includes('delete') ? 'bg-destructive' : log.action.includes('update') ? 'bg-warning' : 'bg-primary'}`} />
              </div>

              <Card className="bg-card/40 border-white/5 backdrop-blur-sm hover:bg-card/60 transition-colors">
                <CardContent className="p-0">
                  <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/10">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-foreground bg-white/5 px-2 py-1 rounded">
                        {log.action.toUpperCase()}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" /> {log.username}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="p-4">
                    {/* Diff viewer if before/after exists */}
                    {log.before && log.after && Object.keys(log.before).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-destructive/5 border border-destructive/10 rounded-md p-3">
                          <span className="text-[10px] font-mono text-destructive/70 mb-2 block uppercase">Before</span>
                          <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                            {JSON.stringify(log.before, null, 2)}
                          </pre>
                        </div>
                        <div className="bg-success/5 border border-success/10 rounded-md p-3">
                          <span className="text-[10px] font-mono text-success/70 mb-2 block uppercase">After</span>
                          <pre className="text-xs font-mono text-foreground overflow-x-auto">
                            {JSON.stringify(log.after, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : log.metadata ? (
                      <div className="bg-black/20 rounded-md p-3">
                        <span className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase">Metadata</span>
                        <pre className="text-xs font-mono text-primary/80 overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-sm font-mono text-muted-foreground italic">No detailed diff available.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
