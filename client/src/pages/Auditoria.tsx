import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Auditoria() {
  const { user } = useAuth();
  const { data: auditLogs, isLoading } = trpc.audit.list.useQuery({ limit: 200 });
  const { data: usersBasic } = trpc.users.listBasic.useQuery();

  if (user?.role !== "admin") {
    return (
      <div className="container py-8">
        <p className="text-center text-muted-foreground">No tiene permisos para acceder a esta página.</p>
      </div>
    );
  }

  const getUserName = (userId: number) => {
    return usersBasic?.find(u => u.id === userId)?.name || `Usuario #${userId}`;
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      create: "bg-green-50 text-green-700 border-green-300",
      update: "bg-blue-50 text-blue-700 border-blue-300",
      delete: "bg-red-50 text-red-700 border-red-300",
      approve: "bg-emerald-50 text-emerald-700 border-emerald-300",
      approve_step: "bg-orange-50 text-orange-700 border-orange-300",
      reject: "bg-red-50 text-red-700 border-red-300",
      update_role: "bg-purple-50 text-purple-700 border-purple-300",
      bulk_import: "bg-cyan-50 text-cyan-700 border-cyan-300",
      pdf_print: "bg-gray-50 text-gray-700 border-gray-300",
      pdf_download: "bg-gray-50 text-gray-700 border-gray-300",
    };
    return (
      <Badge variant="outline" className={colors[action] || "bg-gray-50 text-gray-700 border-gray-300"}>
        {action}
      </Badge>
    );
  };

  const getEntityLabel = (entity: string) => {
    const labels: Record<string, string> = {
      quotation: "Cotización",
      product: "Producto",
      client: "Cliente",
      user: "Usuario",
      margin_settings: "Márgenes",
    };
    return labels[entity] || entity;
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">Log de Auditoría</h1>

      <Card>
        <CardHeader>
          <CardTitle>Últimas acciones del sistema</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Cargando...</p>
          ) : auditLogs?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay registros de auditoría
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs?.map((log) => {
                  let details = "";
                  try {
                    if (log.details) {
                      const parsed = JSON.parse(log.details);
                      details = Object.entries(parsed)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ");
                    }
                  } catch {
                    details = log.details || "";
                  }

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.createdAt).toLocaleString("es-CO")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getUserName(log.userId)}
                      </TableCell>
                      <TableCell>{getEntityLabel(log.entity)}</TableCell>
                      <TableCell>{log.entityId ? `#${log.entityId}` : "-"}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {details}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
