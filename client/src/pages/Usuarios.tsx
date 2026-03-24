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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, UserPlus, KeyRound } from "lucide-react";
import { useState } from "react";

export default function Usuarios() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();

  // Estado para crear usuario
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState(""); // CAMBIO: de newEmail a newUsername
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"vendedor" | "coordinador" | "gerente" | "admin">("vendedor");

  // Estado para resetear contraseña
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Usuario creado exitosamente");
      utils.users.list.invalidate();
      setShowCreate(false);
      setNewName("");
      setNewUsername("");
      setNewPassword("");
      setNewRole("vendedor");
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Rol actualizado exitosamente");
      utils.users.list.invalidate();
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  const resetPasswordMutation = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Contraseña actualizada exitosamente");
      setResetUserId(null);
      setResetPassword("");
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuario eliminado exitosamente");
      utils.users.list.invalidate();
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Gestión de Usuarios</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Crear Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Usuario</DialogTitle>
              <DialogDescription>
                Complete los datos para crear un nuevo usuario.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  name: newName,
                  username: newUsername, // CAMBIO: enviamos username
                  password: newPassword,
                  role: newRole,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="create-name">Nombre Completo</Label>
                <Input
                  id="create-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Juan Pérez"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-username">Nombre de Usuario</Label> 
                <Input
                  id="create-username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="ej: admin, vendedor1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Contraseña</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="coordinador">Coordinador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creando..." : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8">Cargando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name || "N/A"}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.role}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("¿Eliminar usuario?")) deleteMutation.mutate({ id: user.id });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
