import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Package, Users, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: quotations, isLoading: loadingQuotations } = trpc.quotations.list.useQuery();
  const { data: products, isLoading: loadingProducts } = trpc.products.list.useQuery();
  const { data: clients, isLoading: loadingClients } = trpc.clients.list.useQuery();

  const pendingQuotations = quotations?.filter(q => q.status === "pendiente").length || 0;
  const approvedQuotations = quotations?.filter(q => q.status === "aprobada").length || 0;

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Bienvenido, {user?.name || "Usuario"}
        </h1>
        <p className="text-muted-foreground mt-2">
          Sistema de Cotizaciones - Point Colombia
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cotizaciones Pendientes
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingQuotations ? "..." : pendingQuotations}
            </div>
            <p className="text-xs text-muted-foreground">
              Esperando aprobación
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cotizaciones Aprobadas
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingQuotations ? "..." : approvedQuotations}
            </div>
            <p className="text-xs text-muted-foreground">
              Este mes
            </p>
          </CardContent>
        </Card>

        {(user?.role === "admin" || user?.role === "gerente") && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Productos
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingProducts ? "..." : products?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  En inventario
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Clientes
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingClients ? "..." : clients?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Activos
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <a
                href="/nueva-cotizacion"
                className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-accent transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Nueva Cotización</p>
                  <p className="text-sm text-muted-foreground">Crear cotización</p>
                </div>
              </a>

              <a
                href="/mis-cotizaciones"
                className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-accent transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Mis Cotizaciones</p>
                  <p className="text-sm text-muted-foreground">Ver historial</p>
                </div>
              </a>

              {user?.role === "admin" && (
                <a
                  href="/productos"
                  className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Gestionar Productos</p>
                    <p className="text-sm text-muted-foreground">CRUD de productos</p>
                  </div>
                </a>
              )}

              <a
                href="/historico-clientes"
                className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-accent transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Histórico Clientes</p>
                  <p className="text-sm text-muted-foreground">Consultar por cliente</p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
