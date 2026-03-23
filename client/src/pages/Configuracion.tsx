import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function Configuracion() {
  const { user } = useAuth();
  const { data: settings, isLoading } = trpc.marginSettings.get.useQuery();
  const updateMutation = trpc.marginSettings.update.useMutation({
    onSuccess: () => {
      toast.success("Configuración de márgenes actualizada");
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  const [redMax, setRedMax] = useState("");
  const [yellowMax, setYellowMax] = useState("");
  const [tolerance, setTolerance] = useState("");

  useEffect(() => {
    if (settings) {
      setRedMax(String(settings.redMax / 100));
      setYellowMax(String(settings.yellowMax / 100));
      setTolerance(String(settings.tolerance / 100));
    }
  }, [settings]);

  // Solo gerente y admin pueden acceder
  if (user?.role !== "gerente" && user?.role !== "admin") {
    return (
      <div className="container py-8">
        <p className="text-center text-muted-foreground">No tiene permisos para acceder a esta página.</p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const redMaxVal = Math.round(parseFloat(redMax) * 100);
    const yellowMaxVal = Math.round(parseFloat(yellowMax) * 100);
    const toleranceVal = Math.round(parseFloat(tolerance) * 100);

    if (isNaN(redMaxVal) || isNaN(yellowMaxVal) || isNaN(toleranceVal)) {
      toast.error("Ingrese valores numéricos válidos");
      return;
    }

    if (redMaxVal >= yellowMaxVal) {
      toast.error("El umbral rojo debe ser menor que el umbral amarillo/verde");
      return;
    }

    updateMutation.mutate({
      redMax: redMaxVal,
      yellowMax: yellowMaxVal,
      tolerance: toleranceVal,
    });
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <p className="text-center text-muted-foreground">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-foreground mb-8">Configuración de Márgenes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Umbrales del Semáforo</CardTitle>
          <CardDescription>
            Configure los umbrales de margen que determinan el color del semáforo y el flujo de aprobación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vista previa del semáforo */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-red-500 text-white p-4 rounded-lg text-center">
                <div className="text-lg font-bold">ROJO</div>
                <div className="text-sm">{"< "}{redMax}%</div>
                <div className="text-xs mt-1">Aprueba: Gerente</div>
              </div>
              <div className="bg-yellow-500 text-white p-4 rounded-lg text-center">
                <div className="text-lg font-bold">AMARILLO</div>
                <div className="text-sm">{redMax}% - {yellowMax}%</div>
                <div className="text-xs mt-1">Coord. + Gerente</div>
              </div>
              <div className="bg-green-500 text-white p-4 rounded-lg text-center">
                <div className="text-lg font-bold">VERDE</div>
                <div className="text-sm">{">= "}{yellowMax}%</div>
                <div className="text-xs mt-1">Aprueba: Coord.</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="redMax">Umbral Rojo (% máximo para rojo)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="redMax"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={redMax}
                    onChange={(e) => setRedMax(e.target.value)}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Márgenes por debajo de este valor son ROJOS (requieren aprobación directa del Gerente General)
                </p>
              </div>

              <div>
                <Label htmlFor="yellowMax">Umbral Verde (% mínimo para verde)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="yellowMax"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={yellowMax}
                    onChange={(e) => setYellowMax(e.target.value)}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Márgenes por encima de este valor son VERDES (Coordinadora aprueba). Entre rojo y este valor son AMARILLOS (Coordinadora + Gerente)
                </p>
              </div>

              <div>
                <Label htmlFor="tolerance">Tolerancia +/- (para ajustes del Gerente)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tolerance"
                    type="number"
                    step="0.01"
                    min="0"
                    max="50"
                    value={tolerance}
                    onChange={(e) => setTolerance(e.target.value)}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Margen de tolerancia que el Gerente General puede aplicar a los umbrales
                </p>
              </div>
            </div>

            <Button type="submit" disabled={updateMutation.isPending} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
