import React, { createContext, useContext, useEffect } from "react";
import { useGetAuthMe } from "@workspace/api-client-react";
import { AuthUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useGetAuthMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 mins
    }
  });

  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isError && location !== "/login") {
      setLocation("/login");
    }
  }, [isLoading, isError, location, setLocation]);

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        isAuthenticated: !!user && !isError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-mono text-muted-foreground animate-pulse">AUTHENTICATING...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in AuthProvider
  }

  return <>{children}</>;
}
