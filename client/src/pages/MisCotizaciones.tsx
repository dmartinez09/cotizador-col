import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, Download, CheckCircle, XCircle, Clock, Trash2, AlertTriangle } from "lucide-react";

export default function MisCotizaciones() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: quotations, isLoading } = trpc.quotations.list.useQuery();
  const { data: clients } = trpc.clients.list.useQuery();
  const { data: marginSettingsData } = trpc.marginSettings.get.useQuery();
  const { data: usersBasic } = trpc.users.listBasic.useQuery();

  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null);
  const { data: quotationItems } = trpc.quotations.getItems.useQuery(
    { quotationId: selectedQuotationId! },
    { enabled: !!selectedQuotationId }
  );
  const { data: approvalHistoryData } = trpc.quotations.approvalHistory.useQuery(
    { quotationId: selectedQuotationId! },
    { enabled: !!selectedQuotationId }
  );
  const { data: products } = trpc.products.list.useQuery();

  const logPdfAction = trpc.quotations.logPdfAction.useMutation();

  const approveMutation = trpc.quotations.approve.useMutation({
    onSuccess: (data) => {
      if (data.finalApproval) {
        toast.success("Cotización aprobada");
      } else {
        toast.success(data.message || "Paso de aprobación completado");
      }
      utils.quotations.list.invalidate();
      utils.quotations.approvalHistory.invalidate();
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  const rejectMutation = trpc.quotations.reject.useMutation({
    onSuccess: () => {
      toast.success("Cotización rechazada");
      utils.quotations.list.invalidate();
      setSelectedQuotationId(null);
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  const deleteMutation = trpc.quotations.delete.useMutation({
    onSuccess: () => {
      toast.success("Cotización eliminada");
      utils.quotations.list.invalidate();
      setSelectedQuotationId(null);
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Umbrales dinámicos
  const redMax = marginSettingsData?.redMax ?? 1000;
  const yellowMax = marginSettingsData?.yellowMax ?? 3200;

  const getMarginSemaphore = (grossMargin: number) => {
    if (grossMargin < redMax) return "red";
    if (grossMargin < yellowMax) return "yellow";
    return "green";
  };

  const getSemaphoreBadge = (grossMargin: number) => {
    const color = getMarginSemaphore(grossMargin);
    switch (color) {
      case "red":
        return <span className="inline-block w-3 h-3 rounded-full bg-red-500" title="Margen Rojo" />;
      case "yellow":
        return <span className="inline-block w-3 h-3 rounded-full bg-yellow-500" title="Margen Amarillo" />;
      case "green":
        return <span className="inline-block w-3 h-3 rounded-full bg-green-500" title="Margen Verde" />;
    }
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

  const getApprovalStepBadge = (quotation: any) => {
    if (quotation.status !== "pendiente") return null;
    switch (quotation.approvalStep) {
      case "coordinador_pending":
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs">
            Pendiente: Coordinadora
          </Badge>
        );
      case "gerente_pending":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-xs">
            Pendiente: Gerente
          </Badge>
        );
      default:
        return null;
    }
  };

  const selectedQuotation = quotations?.find((q) => q.id === selectedQuotationId);
  const selectedClient = clients?.find((c) => c.id === selectedQuotation?.clientId);
  const vendor = usersBasic?.find((u) => u.id === selectedQuotation?.vendorId);

  // Determinar si el usuario actual puede aprobar esta cotización específica
  const canApprove = (quotation: any) => {
    if (quotation.status !== "pendiente") return false;
    if (user?.role === "admin") return true;
    if (user?.role === "gerente") {
      return quotation.approvalStep === "gerente_pending" || quotation.approvalStep === "none";
    }
    if (user?.role === "coordinador") {
      return quotation.approvalStep === "coordinador_pending" || quotation.approvalStep === "none";
    }
    return false;
  };

  const canReject = (quotation: any) => {
    if (quotation.status !== "pendiente") return false;
    if (user?.role === "admin") return true;
    if (user?.role === "gerente") return true;
    if (user?.role === "coordinador") {
      return quotation.approvalStep !== "gerente_pending";
    }
    return false;
  };

  // Vendedor y coordinador pueden ver el margen numérico según su rol
  const canSeeMarginValue = user?.role === "admin" || user?.role === "gerente" || user?.role === "coordinador";

  const handlePrintPDF = () => {
    if (selectedQuotationId) {
      logPdfAction.mutate({ quotationId: selectedQuotationId, action: "print" });
    }
    window.print();
  };

  const getUserName = (userId: number | null) => {
    if (!userId) return "N/A";
    const u = usersBasic?.find(u => u.id === userId);
    return u?.name || "N/A";
  };

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Mis Cotizaciones</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Cotizaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Cargando...</p>
          ) : quotations?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay cotizaciones registradas
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Precio Neto</TableHead>
                  <TableHead className="text-center">Semáforo</TableHead>
                  {canSeeMarginValue && (
                    <TableHead className="text-right">Margen</TableHead>
                  )}
                  <TableHead>Estado</TableHead>
                  <TableHead>Paso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations?.map((quotation) => {
                  const client = clients?.find((c) => c.id === quotation.clientId);
                  return (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium">#{quotation.id}</TableCell>
                      <TableCell>{client?.name || "N/A"}</TableCell>
                      <TableCell>
                        {new Date(quotation.createdAt).toLocaleDateString("es-CO")}
                      </TableCell>
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
                      <TableCell>{getApprovalStepBadge(quotation)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedQuotationId(quotation.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {quotation.status === "pendiente" &&
                            (user?.role === "vendedor" ||
                              quotation.vendorId === user?.id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate({ id: quotation.id })}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Detalle */}
      <Dialog open={!!selectedQuotationId} onOpenChange={() => setSelectedQuotationId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Cotización #{selectedQuotationId}</DialogTitle>
          </DialogHeader>

          {selectedQuotation && (
            <div className="space-y-6">
              {/* Información del Cliente */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Cliente:</p>
                  <p className="font-medium">{selectedClient?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Zona:</p>
                  <p className="font-medium">{selectedClient?.zone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vendedor:</p>
                  <p className="font-medium">{vendor?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha:</p>
                  <p className="font-medium">
                    {new Date(selectedQuotation.createdAt).toLocaleDateString("es-CO")}
                  </p>
                </div>
              </div>

              {/* Semáforo en detalle */}
              <div className="flex items-center gap-3">
                {getSemaphoreBadge(selectedQuotation.grossMargin)}
                <span className="text-sm text-muted-foreground">
                  {getMarginSemaphore(selectedQuotation.grossMargin) === "green" ? "Margen Óptimo" :
                   getMarginSemaphore(selectedQuotation.grossMargin) === "yellow" ? "Margen Aceptable" :
                   "Margen Crítico"}
                </span>
                {canSeeMarginValue && (
                  <span className="text-sm font-medium">
                    ({(selectedQuotation.grossMargin / 100).toFixed(1)}%)
                  </span>
                )}
                {getApprovalStepBadge(selectedQuotation)}
              </div>

              {/* Productos */}
              <div>
                <h3 className="font-semibold mb-3">Productos</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio Lista</TableHead>
                      <TableHead className="text-right">Precio Neto Unit.</TableHead>
                      {(user?.role === "admin" || user?.role === "gerente") && (
                        <TableHead className="text-right">Costo Unit.</TableHead>
                      )}
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotationItems?.map((item) => {
                      const product = products?.find((p) => p.id === item.productId);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            {product?.description || "N/A"}
                            {item.isBonus === 1 && (
                              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                BONIFICACIÓN
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(product?.price ?? item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unitPrice)}
                          </TableCell>
                          {(user?.role === "admin" || user?.role === "gerente") && (
                            <TableCell className="text-right">
                              {formatCurrency(item.unitCost)}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            {formatCurrency(item.subtotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Totales */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Precio Neto:</span>
                  <span className="text-primary">{formatCurrency(selectedQuotation.subtotal)}</span>
                </div>

                {(user?.role === "admin" || user?.role === "gerente") && (
                  <>
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Costo Total:</span>
                      <span className="font-medium">
                        {formatCurrency(selectedQuotation.totalCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Utilidad Bruta:</span>
                      <span className="font-medium">
                        {formatCurrency(selectedQuotation.grossProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Margen Bruto:</span>
                      <span className="font-medium">
                        {(selectedQuotation.grossMargin / 100).toFixed(2)}%
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Historial de aprobaciones */}
              {approvalHistoryData && approvalHistoryData.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h3 className="font-semibold mb-3">Historial de Aprobaciones</h3>
                  <div className="space-y-2">
                    {approvalHistoryData.map((record) => (
                      <div key={record.id} className="flex items-center gap-2 text-sm">
                        {record.action === "aprobada" ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">{getUserName(record.userId)}</span>
                        <span className="text-muted-foreground">
                          ({record.step}) - {record.action}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(record.createdAt).toLocaleString("es-CO")}
                        </span>
                        {record.comment && (
                          <span className="text-muted-foreground italic">"{record.comment}"</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 justify-end no-print">
                {selectedQuotation.status === "aprobada" && (
                  <Button onClick={handlePrintPDF} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar PDF
                  </Button>
                )}

                {canApprove(selectedQuotation) && (
                  <Button
                    onClick={() => approveMutation.mutate({ id: selectedQuotation.id })}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {selectedQuotation.approvalStep === "coordinador_pending" && user?.role === "coordinador"
                      ? "Aprobar (Paso 1)"
                      : "Aprobar"}
                  </Button>
                )}

                {canReject(selectedQuotation) && (
                  <Button
                    variant="destructive"
                    onClick={() => rejectMutation.mutate({ id: selectedQuotation.id })}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rechazar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
