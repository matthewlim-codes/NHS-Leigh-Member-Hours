import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import TeacherPortalPage from "@/pages/teacher";
import TutorOsHomePage from "@/tutoros/pages/home";
import TutorOsStartPage from "@/tutoros/pages/start";
import TutorOsSessionPage from "@/tutoros/pages/session";
import TutorOsVerifyPage from "@/tutoros/pages/verify";
import TutorOsHistoryPage from "@/tutoros/pages/history";

const queryClient = new QueryClient();

function isPublicPath(location: string) {
  return location === "/login" || location.startsWith("/tutoros/verify/");
}

function homeForRole(role?: string) {
  return role === "teacher" ? "/teacher" : "/tutoros";
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isSuccess, isError, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  useEffect(() => {
    if (isLoading) return;

    if (isError && !isPublicPath(location)) {
      setLocation("/login");
      return;
    }

    if (isSuccess && user) {
      const isTeacher = user.role === "teacher";

      if (location === "/login" || location === "/") {
        setLocation(homeForRole(user.role));
        return;
      }

      if (isTeacher && location.startsWith("/tutoros")) {
        setLocation("/teacher");
        return;
      }

      if (isTeacher && location === "/dashboard") {
        setLocation("/teacher");
        return;
      }

      if (!isTeacher && location.startsWith("/teacher")) {
        setLocation("/tutoros");
      }
    }
  }, [isLoading, isError, isSuccess, user, location, setLocation]);

  if (isLoading && location === "/") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/teacher" component={TeacherPortalPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/tutoros/start" component={TutorOsStartPage} />
      <Route path="/tutoros/session/:id" component={TutorOsSessionPage} />
      <Route path="/tutoros/verify/:id" component={TutorOsVerifyPage} />
      <Route path="/tutoros/history" component={TutorOsHistoryPage} />
      <Route path="/tutoros" component={TutorOsHomePage} />
      <Route path="/" component={() => null} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate>
            <Router />
          </AuthGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
