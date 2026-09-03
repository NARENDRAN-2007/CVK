import { Toaster } from "sonner";
import { Route, Switch } from "wouter";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/sign-in"><AuthPage mode="sign-in" /></Route>
      <Route path="/create-account"><AuthPage mode="create-account" /></Route>
      <Route path="/404" component={NotFound} />
      <Route component={Home} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <Toaster position="top-right" richColors />
        <Router />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
