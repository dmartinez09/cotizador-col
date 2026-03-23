import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PointDashboardLayout } from "./components/PointDashboardLayout";
import Dashboard from "./pages/Dashboard";
import NuevaCotizacion from "./pages/NuevaCotizacion";
import MisCotizaciones from "./pages/MisCotizaciones";
import Productos from "./pages/Productos";
import Clientes from "./pages/Clientes";
import Usuarios from "./pages/Usuarios";
import Configuracion from "./pages/Configuracion";
import HistoricoClientes from "./pages/HistoricoClientes";
import Auditoria from "./pages/Auditoria";
import Login from "./pages/Login";

function Router() {
  return (
    <Switch>
      {/* Login fuera del layout principal (sin sidebar) */}
      <Route path="/login" component={Login} />

      {/* Todas las demás rutas dentro del layout protegido */}
      <Route>
        <PointDashboardLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/nueva-cotizacion" component={NuevaCotizacion} />
            <Route path="/mis-cotizaciones" component={MisCotizaciones} />
            <Route path="/historico-clientes" component={HistoricoClientes} />
            <Route path="/productos" component={Productos} />
            <Route path="/clientes" component={Clientes} />
            <Route path="/usuarios" component={Usuarios} />
            <Route path="/configuracion" component={Configuracion} />
            <Route path="/auditoria" component={Auditoria} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </PointDashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
