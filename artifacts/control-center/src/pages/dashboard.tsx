import React from "react";
import { useGetDashboardStats, useGetDashboardActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Cpu, Database, Server, Users, Power, Zap, AlertCircle, MemoryStick } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

// Mock data for sparklines since API doesn't provide historical timeseries for these yet
const generateSparklineData = (baseValue: number, volatility: number) => {
  return Array.from({ length: 20 }).map((_, i) => ({
    value: Math.max(0, baseValue + (Math.random() * volatility * 2 - volatility)),
    time: i
  }));
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { refetchInterval: 5000 }
  });
  
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity({
    query: { refetchInterval: 10000 }
  });

  if (statsLoading || !stats) {
    return (
      <div className="p-8 h-full flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-card/50 border-white/5 animate-pulse">
              <CardHeader className="h-24"></CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const isOnline = stats.bot.status.toLowerCase() === 'online';

  return (
    <div className="p-6 md:p-8 h-full flex flex-col gap-8 max-w-7xl mx-auto">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">System Overview</h1>
          <p className="text-muted-foreground font-mono text-sm flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-success' : 'bg-destructive'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-success' : 'bg-destructive'}`}></span>
            </span>
            BOT_STATUS: {stats.bot.status.toUpperCase()}
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono text-muted-foreground mb-1">UPTIME</span>
            <span className="font-mono text-sm bg-white/5 px-2 py-1 rounded border border-white/5">
              {Math.floor(stats.bot.uptime / 3600)}h {Math.floor((stats.bot.uptime % 3600) / 60)}m
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono text-muted-foreground mb-1">LATENCY</span>
            <span className="font-mono text-sm bg-white/5 px-2 py-1 rounded border border-white/5 flex items-center gap-1">
              <Zap className="w-3 h-3 text-warning" />
              {stats.bot.ping || 0}ms
            </span>
          </div>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Connected Servers" 
          value={stats.bot.servers.toLocaleString()} 
          icon={<Server className="w-4 h-4 text-primary" />} 
          data={generateSparklineData(stats.bot.servers, stats.bot.servers * 0.05)}
          color="var(--color-primary)"
        />
        <MetricCard 
          title="Total Users" 
          value={stats.bot.users.toLocaleString()} 
          icon={<Users className="w-4 h-4 text-chart-2" />} 
          data={generateSparklineData(stats.bot.users, stats.bot.users * 0.01)}
          color="var(--color-chart-2)"
        />
        <MetricCard 
          title="Memory Usage" 
          value={`${stats.bot.memoryMb.toFixed(1)} MB`} 
          icon={<MemoryStick className="w-4 h-4 text-chart-4" />} 
          data={generateSparklineData(stats.bot.memoryMb, 10)}
          color="var(--color-chart-4)"
        />
        <MetricCard 
          title="CPU Load" 
          value={`${stats.bot.cpuPercent.toFixed(1)}%`} 
          icon={<Cpu className="w-4 h-4 text-warning" />} 
          data={generateSparklineData(stats.bot.cpuPercent, 2)}
          color="var(--color-warning)"
        />
      </div>

      {/* Lower Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px]">
        
        {/* System Health Panel */}
        <Card className="col-span-1 bg-card/40 border-white/5 backdrop-blur-sm flex flex-col">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              SYSTEM_DIAGNOSTICS
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex-1 flex flex-col gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground font-mono">DB_CONNECTION</span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded ${stats.system.dbStatus === 'connected' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                  {stats.system.dbStatus.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground font-mono">NODE_ENV</span>
                <span className="text-xs font-mono text-foreground">{stats.system.nodeVersion || 'v20.x'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground font-mono">MODULES_ACTIVE</span>
                <span className="text-xs font-mono text-foreground">{stats.system.activeModules}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground font-mono">CMDS_LOADED</span>
                <span className="text-xs font-mono text-foreground">{stats.system.loadedCommands}</span>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-white/5">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-destructive mb-1">Recent Errors ({stats.system.recentErrorCount})</h4>
                  <p className="text-xs text-muted-foreground">Logged in the last 24 hours. Check Audit Logs for details.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="col-span-1 lg:col-span-2 bg-card/40 border-white/5 backdrop-blur-sm flex flex-col">
          <CardHeader className="border-b border-white/5 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              LIVE_FEED
            </CardTitle>
            <div className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto p-4 space-y-1">
              {activityLoading ? (
                <div className="text-center py-8 text-muted-foreground font-mono text-sm">LOADING_STREAM...</div>
              ) : activity?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground font-mono text-sm">NO_ACTIVITY_DETECTED</div>
              ) : (
                activity?.map((entry, idx) => (
                  <div key={entry.id} className="flex gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group">
                    <div className="w-24 shrink-0 text-xs font-mono text-muted-foreground pt-0.5">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 uppercase tracking-wider
                          ${entry.type === 'error' ? 'text-destructive border-destructive/30 bg-destructive/10' : 
                            entry.type === 'command' ? 'text-primary' : 
                            entry.type === 'system' ? 'text-warning' : 'text-muted-foreground'}`}>
                          {entry.type}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 font-mono break-words">{entry.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, data, color }: { title: string, value: string | number, icon: React.ReactNode, data: any[], color: string }) {
  return (
    <Card className="bg-card/40 border-white/5 backdrop-blur-sm relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <span className="text-xs font-mono text-muted-foreground mb-1">{title.toUpperCase()}</span>
            <span className="text-2xl font-bold tracking-tight">{value}</span>
          </div>
          <div className="p-2 rounded-md bg-white/5 border border-white/10">
            {icon}
          </div>
        </div>
        <div className="h-[40px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <YAxis domain={['dataMin', 'dataMax']} hide />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={color} 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
