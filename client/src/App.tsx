import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isStaticPagesBuild, officialSiteUrl, routerBase } from "@/lib/site";
import { lazy, Suspense, useEffect } from "react";
import { Route, Router as WouterRouter, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
const ReviewAdmin = lazy(() => import("./pages/ReviewAdmin"));
const About = lazy(() => import("./pages/About"));

function ReviewRoute() {
  useEffect(() => {
    if (isStaticPagesBuild) window.location.replace(`${officialSiteUrl}/review`);
  }, []);
  if (isStaticPagesBuild) {
    return <main className="admin-loading">管理校訂台使用正式後端，正在前往正式網站……</main>;
  }
  return <Suspense fallback={<main className="admin-loading">載入人工校訂台……</main>}><ReviewAdmin /></Suspense>;
}

function AboutRoute() {
  return <Suspense fallback={<main className="admin-loading">載入讀本說明……</main>}><About /></Suspense>;
}
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={AboutRoute} />
      <Route path="/review" component={ReviewRoute} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" />
          <WouterRouter base={routerBase}>
            <Router />
          </WouterRouter>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
