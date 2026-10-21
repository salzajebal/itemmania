import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/AuthContext";
import NotFound from "@/pages/not-found";
import Home from "./pages/Home";
import MyPage from "./pages/MyPage";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { AuthModal } from "./components/modals/AuthModal";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/mypage" component={MyPage} />
      <Route path="/chat/:roomId" component={Chat} />
      <Route path="/banana777" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function SupportWidgetLoader() {
  useEffect(() => {
    if (window.location.pathname.includes("/banana777")) return;
    if (document.querySelector("script[data-support-widget]")) return;
    const s = document.createElement("script");
    s.src = "/api/support/widget.js";
    s.defer = true;
    s.setAttribute("data-support-widget", "1");
    document.body.appendChild(s);
  }, []);
  return null;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <AuthModal />
            <SupportWidgetLoader />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
