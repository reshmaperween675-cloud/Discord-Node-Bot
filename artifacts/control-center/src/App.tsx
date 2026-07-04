import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider, RequireAuth } from '@/components/auth-context';
import { AppLayout } from '@/components/layout';
import { CommandPalette } from '@/components/command-palette';
import { AIAssistant } from '@/components/ai-assistant';

import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import CommandsPage from '@/pages/commands';
import EmbedsPage from '@/pages/embeds';
import ModulesPage from '@/pages/modules';
import BotControlPage from '@/pages/bot-control';
import FilesPage from '@/pages/files';
import DatabasePage from '@/pages/database';
import AuditLogsPage from '@/pages/audit-logs';
import SearchPage from '@/pages/search';

const queryClient = new QueryClient();

function ProtectedApp() {
  return (
    <RequireAuth>
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/commands" component={CommandsPage} />
          <Route path="/embeds" component={EmbedsPage} />
          <Route path="/modules" component={ModulesPage} />
          <Route path="/bot-control" component={BotControlPage} />
          <Route path="/files" component={FilesPage} />
          <Route path="/database" component={DatabasePage} />
          <Route path="/audit-logs" component={AuditLogsPage} />
          <Route path="/search" component={SearchPage} />
          <Route component={NotFound} />
        </Switch>
        <CommandPalette />
        <AIAssistant />
      </AppLayout>
    </RequireAuth>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="*">
        <ProtectedApp />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
