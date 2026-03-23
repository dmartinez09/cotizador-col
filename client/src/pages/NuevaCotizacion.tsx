import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { Trash2, Plus, Gift } from "lucide-react";
import { useLocation } from "wouter";

interface QuotationItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  isBonus: boolean;
  subtotal: number;
}

export default function NuevaCotizacion() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: products } = trpc.products.list.useQuery();
  const { data: clients } = trpc.clients.list.useQuery();
  const { data: marginSettingsData } = trpc.marginSettings.get.useQuery();
  const createQuotation = trpc.quotations.create.useMutation({
    onSuccess: () => {
      toast.success("Cotización creada exitosamente");
      setLocation("/mis-cotizaciones");
    },
    onError: (error) => {
      toast.error("Error al crear cotización: " + error.message);
    },
  });

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");

  const selectedClient = clients?.find((c) => c.id === Number(selectedClientId));

  // Umbrales dinámicos desde configuración
  const redMax = marginSettingsData?.redMax ?? 1000;
  const yellowMax = marginSettingsData?.yellowMax ?? 3200;

  const addItem = (isBonus: boolean = false) => {
    if (!selectedProductId) {
      toast.error("Seleccione un producto");
      return;
    }

    const product = products?.find((p) => p.id === Number(selectedProductId));
    if (!product) return;

    const qty = parseInt(quantity) || 1;
    const unitPrice = isBonus ? 0 : product.price;
    const subtotal = unitPrice * qty;

    const newItem: QuotationItem = {
      productId: product.id,
      productName: product.description,
      quantity: qty,
      unitPrice,
      unitCost: product.cost,
      isBonus,
      subtotal,
    };

    setItems([...items, newItem]);
    setSelectedProductId("");
    setQuantity("1");
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculations = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
    // Precio Lista = suma de precios de catálogo * cantidad (referencia)
    const precioLista = items.reduce((sum, item) => {
      const product = products?.find(p => p.id === item.productId);
      return sum + (product?.price ?? item.unitPrice) * item.quantity;
    }, 0);
    const total = subtotal; // Precio neto = subtotal (sin IVA)
    const iva = 0; // IVA no se muestra en el front
    const grossProfit = subtotal - totalCost;
    const grossMargin = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;

    return {
      subtotal,
      totalCost,
      precioLista,
      iva,
      total,
      grossProfit,
      grossMargin,
    };
  }, [items, products]);

  const getMarginColor = (margin: number) => {
    const redThreshold = redMax / 100;
    const yellowThreshold = yellowMax / 100;

    if (margin < redThreshold) return { bg: "bg-red-500", text: "Requiere Aprobación: GERENTE GENERAL", opacity: 0.8 + (margin / redThreshold) * 0.2, color: "rojo" };
    if (margin < yellowThreshold) return { bg: "bg-yellow-500", text: "Requiere Aprobación: COORDINADORA → GERENTE", opacity: 0.8 + ((margin - redThreshold) / (yellowThreshold - redThreshold)) * 0.2, color: "amarillo" };
    return { bg: "bg-green-500", text: "Requiere Aprobación: COORDINADOR", opacity: 0.8 + Math.min((margin - yellowThreshold) / (100 - yellowThreshold), 1) * 0.2, color: "verde" };
  };

  const marginInfo = getMarginColor(calculations.grossMargin);

  // Determinar si el usuario puede ver el porcentaje numérico del margen
  const canSeeMarginValue = user?.role === "admin" || user?.role === "gerente" || user?.role === "coordinador";

  const handleSubmit = () => {
    if (!selectedClientId) {
      toast.error("Seleccione un cliente");
      return;
    }

    if (items.length === 0) {
      toast.error("Agregue al menos un producto");
      return;
    }

    createQuotation.mutate({
      clientId: Number(selectedClientId),
      subtotal: calculations.subtotal,
      iva: calculations.iva,
      total: calculations.total,
      totalCost: calculations.totalCost,
      grossProfit: calculations.grossProfit,
      grossMargin: Math.round(calculations.grossMargin * 100), // Multiplicar por 100 para almacenar
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        isBonus: item.isBonus ? 1 : 0,
        subtotal: item.subtotal,
      })),
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="container py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-foreground mb-8">Nueva Cotización</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Selección de Cliente */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="client">Cliente</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger id="client">
                      <SelectValue placeholder="Seleccione un cliente" />
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
                {selectedClient && (
                  <div className="text-sm text-muted-foreground">
                    Zona: <span className="font-medium">{selectedClient.zone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agregar Productos */}
          <Card>
            <CardHeader>
              <CardTitle>Agregar Productos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <Label htmlFor="product">Producto</Label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger id="product">
                        <SelectValue placeholder="Seleccione un producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.description} — Precio Lista: {formatCurrency(product.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="quantity">Cantidad</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => addItem(false)} className="flex-1">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Producto
                  </Button>
                  <Button onClick={() => addItem(true)} variant="outline" className="flex-1">
                    <Gift className="mr-2 h-4 w-4" />
                    Agregar Bonificación
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Productos */}
          <Card>
            <CardHeader>
              <CardTitle>Productos en Cotización</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay productos agregados
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio Lista</TableHead>
                      <TableHead className="text-right">Precio Neto Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => {
                      const product = products?.find(p => p.id === item.productId);
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            {item.productName}
                            {item.isBonus && (
                              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                BONIFICACIÓN
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(product?.price ?? item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.subtotal)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

        {/* Panel de Resumen y Semáforo */}
        <div className="space-y-6">
          {/* Semáforo de Rentabilidad - visible para TODOS los roles */}
          {items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Indicador de Rentabilidad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`${marginInfo.bg} text-white p-6 rounded-lg text-center`}
                  style={{ opacity: marginInfo.opacity }}
                >
                  {/* Vendedor solo ve el color y el texto de aprobación, NO el porcentaje */}
                  {canSeeMarginValue ? (
                    <div className="text-4xl font-bold mb-2">
                      {calculations.grossMargin.toFixed(1)}%
                    </div>
                  ) : (
                    <div className="text-2xl font-bold mb-2 uppercase">
                      {marginInfo.color === "verde" ? "Margen Óptimo" :
                       marginInfo.color === "amarillo" ? "Margen Aceptable" :
                       "Margen Crítico"}
                    </div>
                  )}
                  <div className="text-sm font-medium">{marginInfo.text}</div>
                </div>

                {/* Gauge/Medidor */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>60%</span>
                    <span>70%</span>
                    <span>80%</span>
                    <span>100%</span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${marginInfo.bg} transition-all duration-500`}
                      style={{ width: `${Math.min(canSeeMarginValue ? calculations.grossMargin : (marginInfo.color === "verde" ? 75 : marginInfo.color === "amarillo" ? 50 : 25), 100)}%` }}
                    />
                  </div>
                </div>

                {/* Detalles financieros solo para admin y gerente */}
                {(user?.role === "admin" || user?.role === "gerente") && (
                  <div className="pt-4 border-t border-border space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Utilidad Bruta:</span>
                      <span className="font-medium">{formatCurrency(calculations.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Costo Total:</span>
                      <span className="font-medium">{formatCurrency(calculations.totalCost)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Resumen de Totales */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Precio Lista:</span>
                <span className="font-medium text-muted-foreground">{formatCurrency(calculations.precioLista)}</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold">Precio Neto:</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(calculations.total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={createQuotation.isPending || items.length === 0 || !selectedClientId}
          >
            {createQuotation.isPending ? "Guardando..." : "Crear Cotización"}
          </Button>
        </div>
      </div>
    </div>
  );
}
