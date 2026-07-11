import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import TutorOsHomePage from "@/tutoros/pages/home";
import TutorOsExplorePage from "@/tutoros/pages/explore";
import TutorOsBookmarksPage from "@/tutoros/pages/bookmarks";
import TutorOsSubjectPage from "@/tutoros/pages/subject";
import TutorOsCoursePage from "@/tutoros/pages/course";
import TutorOsUnitPage from "@/tutoros/pages/unit";

const queryClient = new QueryClient();

function isPublicPath(location: string) {
  return location === "/login";
}

// Auth redirect handler to properly route the user based on state initially
function AuthGate({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isSuccess, isError, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false
    }
  });

  useEffect(() => {
    if (isLoading) return;
    
    // If not logged in and not on login page, redirect to login
    if (isError && !isPublicPath(location)) {
      setLocation("/login");
      return;
    }
    
    if (isSuccess && user) {
      if (location === "/login" || location === "/") {
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
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/tutoros/courses/:courseId/units/:unitId" component={TutorOsUnitPage} />
      <Route path="/tutoros/courses/:courseId" component={TutorOsCoursePage} />
      <Route path="/tutoros/subjects/:subjectId" component={TutorOsSubjectPage} />
      <Route path="/tutoros/explore" component={TutorOsExplorePage} />
      <Route path="/tutoros/bookmarks" component={TutorOsBookmarksPage} />
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
