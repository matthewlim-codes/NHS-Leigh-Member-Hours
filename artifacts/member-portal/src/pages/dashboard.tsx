import { useGetMe, getGetMeQueryKey, useGetDashboard, getGetDashboardQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: user, isError: isAuthError, isSuccess: isAuthSuccess, isLoading: isAuthLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false
    }
  });

  useEffect(() => {
    if (isAuthError) {
      setLocation("/login");
    } else if (isAuthSuccess && user?.mustChangePassword) {
      setLocation("/change-password");
    }
  }, [isAuthError, isAuthSuccess, user, setLocation]);

  const { data: dashboard, isError: isDashboardError, isLoading: isDashboardLoading, error: dashboardError } = useGetDashboard({
    query: {
      queryKey: getGetDashboardQueryKey(),
      enabled: isAuthSuccess && user && !user.mustChangePassword,
      retry: false
    }
  });

  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  if (isAuthLoading || (isAuthSuccess && !user?.mustChangePassword && isDashboardLoading)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading your dashboard...</div>
      </div>
    );
  }

  // Prevent flash of content while redirecting
  if (!user || user.mustChangePassword) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="font-bold text-lg text-foreground flex items-center gap-2">
            NHS (Leigh)
          </h1>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 py-8 md:py-12 flex flex-col items-center">
        {isDashboardError ? (
          <Alert variant="destructive" className="max-w-md w-full" data-testid="alert-dashboard-error">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Member not found</AlertTitle>
            <AlertDescription>
              {dashboardError?.error || "We couldn't find your hours record in the system. Please ask the coordinator to check your details."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="w-full max-w-md flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <p className="text-lg text-muted-foreground mb-1" data-testid="text-welcome-greeting">
                Hello,
              </p>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground" data-testid="text-display-name">
                {dashboard?.displayName || user.username}
              </h2>
            </div>

            <Card className="w-full shadow-lg border-primary/20 bg-card overflow-hidden">
              <CardContent className="p-8 md:p-12 flex flex-col items-center justify-center text-center">
                <div className="bg-primary/10 p-4 rounded-full mb-6">
                  <Clock className="w-10 h-10 text-primary" />
                </div>
                <p className="text-muted-foreground text-sm uppercase tracking-wider font-semibold mb-2" data-testid="text-hours-label">
                  Total Volunteer Hours
                </p>
                <div className="text-7xl md:text-8xl font-display font-bold text-primary tracking-tighter" data-testid="text-hours-value">
                  {dashboard?.hours ?? 0}
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 text-center bg-secondary/50 rounded-xl p-6 w-full text-secondary-foreground border border-secondary">
              <p className="text-sm font-medium" data-testid="text-thank-you">
                Thank you for your continued support and dedication to our community.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
