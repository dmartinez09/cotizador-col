import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Search } from "lucide-react";

export default function HistoricoClientes() {
  const { user } = useAuth();
  const { data: clients } = trpc.clients.list.useQuery();
  const { data: marginSettingsData } = trpc.marginSettings.get.useQuery();
  const { data: usersBasic } = trpc.users.listBasic.useQuery();

  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const { data: clientQuotations, isLoading } = trpc.quotations.byClient.useQuery(
    { clientId: Number(selectedClientId) },
    { enabled: !!selectedClientId }
  );

  const redMax = marginSettingsData?.redMax ?? 1000;
  const yellowMax = marginSettingsData?.yellowMax ?? 3200;

  const canSeeMarginValue = user?.role === "admin" || user?.role === "gerente" || user?.role === "coordinador";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getSemaphoreBadge = (grossMargin: number) => {
    if (grossMargin < redMax) return <span className="inline-block w-3 h-3 rounded-full bg-red-500" title="Rojo" />;
    if (grossMargin < yellowMax) return <span className="inline-block w-3 h-3 rounded-full bg-yellow-500" title="Amarillo" />;
    return <span className="inline-block w-3 h-3 rounded-full bg-green-500" title="Verde" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendiente":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
            <Clock className="mr-1 h-3 w-3" />
            Pendiente
          </Badge>
        );
      case "aprobada":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <CheckCircle className="mr-1 h-3 w-3" />
            Aprobada
          </Badge>
        );
      case "rechazada":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
            <XCircle className="mr-1 h-3 w-3" />
            Rechazada
          </Badge>
        );
      default:
        return null;
    }
  };

  const selectedClient = clients?.find(c => c.id === Number(selectedClientId));

  // Calcular resumen
  const totalQuotations = clientQuotations?.length || 0;
  const approvedQuotations = clientQuotations?.filter(q => q.status === "aprobada").length || 0;
  const totalApprovedValue = clientQuotations
    ?.filter(q => q.status === "aprobada")
    .reduce((sum, q) => sum + q.subtotal, 0) || 0;

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">Histórico por Cliente</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Seleccionar Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un cliente para ver su historial" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name} - {client.zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClientId && selectedClient && (
        <>
          {/* Resumen del cliente */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{totalQuotations}</div>
                <p className="text-sm text-muted-foreground">Cotizaciones Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{approvedQuotations}</div>
                <p className="text-sm text-muted-foreground">Aprobadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-primary">{formatCurrency(totalApprovedValue)}</div>
                <p className="text-sm text-muted-foreground">Valor Total Aprobado</p>
              </CardContent>
            </Card>
          </div>

          {/* Lista de cotizaciones */}
          <Card>
            <CardHeader>
              <CardTitle>Cotizaciones de {selectedClient.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Cargando...</p>
              ) : clientQuotations?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay cotizaciones para este cliente
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Precio Neto</TableHead>
                      <TableHead className="text-center">Semáforo</TableHead>
                      {canSeeMarginValue && (
                        <TableHead className="text-right">Margen</TableHead>
                      )}
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientQuotations?.map((quotation) => {
                      const vendorName = usersBasic?.find(u => u.id === quotation.vendorId)?.name || "N/A";
                      return (
                        <TableRow key={quotation.id}>
                          <TableCell className="font-medium">#{quotation.id}</TableCell>
                          <TableCell>
                            {new Date(quotation.createdAt).toLocaleDateString("es-CO")}
                          </TableCell>
                          <TableCell>{vendorName}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(quotation.subtotal)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getSemaphoreBadge(quotation.grossMargin)}
                          </TableCell>
                          {canSeeMarginValue && (
                            <TableCell className="text-right">
                              {(quotation.grossMargin / 100).toFixed(1)}%
                            </TableCell>
                          )}
                          <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedClientId && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Seleccione un cliente para ver su historial de cotizaciones</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
