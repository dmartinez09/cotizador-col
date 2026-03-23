import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import {
  FileText,
  Package,
  Users,
  UserCircle,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Settings,
  History,
  Shield
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

interface PointDashboardLayoutProps {
  children: React.ReactNode;
}

export function PointDashboardLayout({ children }: PointDashboardLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirigir a la página de login
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      roles: ["vendedor", "coordinador", "gerente", "admin"],
    },
    {
      name: "Nueva Cotización",
      href: "/nueva-cotizacion",
      icon: FileText,
      roles: ["vendedor", "coordinador", "gerente", "admin"],
    },
    {
      name: "Mis Cotizaciones",
      href: "/mis-cotizaciones",
      icon: FileText,
      roles: ["vendedor", "coordinador", "gerente", "admin"],
    },
    {
      name: "Histórico Clientes",
      href: "/historico-clientes",
      icon: History,
      roles: ["vendedor", "coordinador", "gerente", "admin"],
    },
    {
      name: "Productos",
      href: "/productos",
      icon: Package,
      roles: ["admin"],
    },
    {
      name: "Clientes",
      href: "/clientes",
      icon: Users,
      roles: ["admin"],
    },
    {
      name: "Usuarios",
      href: "/usuarios",
      icon: UserCircle,
      roles: ["admin"],
    },
    {
      name: "Configuración Márgenes",
      href: "/configuracion",
      icon: Settings,
      roles: ["gerente", "admin"],
    },
    {
      name: "Auditoría",
      href: "/auditoria",
      icon: Shield,
      roles: ["admin"],
    },
  ];

  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(user?.role || "vendedor")
  );

  const getRoleLabel = (role: string | undefined) => {
    switch (role) {
      case "admin": return "Administrador";
      case "gerente": return "Gerente General";
      case "coordinador": return "Coordinadora Comercial";
      case "vendedor": return "Vendedor";
      default: return role;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r border-border transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold">
                P
              </div>
              <span className="text-lg font-semibold text-foreground">Point Colombia</span>
            </div>
            <button
              className="lg:hidden text-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navegación */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <li key={item.name}>
                    <Link href={item.href}>
                      <a
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </a>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Usuario */}
          <div className="border-t border-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground">{user?.name || "Usuario"}</p>
                    <p className="text-xs text-muted-foreground">{getRoleLabel(user?.role)}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logoutMutation.mutate()}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header móvil */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-foreground"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold">
              P
            </div>
            <span className="text-lg font-semibold text-foreground">Point Colombia</span>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
