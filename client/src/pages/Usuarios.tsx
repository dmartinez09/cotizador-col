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
  const [newEmail, setNewEmail] = useState("");
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
      setNewEmail("");
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="default">Administrador</Badge>;
      case "gerente":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300" variant="outline">Gerente General</Badge>;
      case "coordinador":
        return <Badge variant="secondary">Coordinadora Comercial</Badge>;
      case "vendedor":
        return <Badge variant="outline">Vendedor</Badge>;
      default:
        return null;
    }
  };

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
                Complete los datos para crear un nuevo usuario con acceso al sistema.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  name: newName,
                  email: newEmail,
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
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Correo Electrónico</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="juan@empresa.com"
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
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as typeof newRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="coordinador">Coordinadora Comercial</SelectItem>
                    <SelectItem value="gerente">Gerente General</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
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
            <p className="text-center text-muted-foreground py-8">Cargando...</p>
          ) : users?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay usuarios registrados
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Último Acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.id}</TableCell>
                    <TableCell>{user.name || "N/A"}</TableCell>
                    <TableCell>{user.email || "N/A"}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) =>
                          updateRoleMutation.mutate({
                            id: user.id,
                            role: value as "vendedor" | "coordinador" | "gerente" | "admin",
                          })
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vendedor">Vendedor</SelectItem>
                          <SelectItem value="coordinador">Coordinadora Comercial</SelectItem>
                          <SelectItem value="gerente">Gerente General</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {new Date(user.lastSignedIn).toLocaleDateString("es-CO")}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {/* Reset Password */}
                      <Dialog open={resetUserId === user.id} onOpenChange={(open) => { if (!open) setResetUserId(null); }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetUserId(user.id)}
                            title="Resetear contraseña"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Resetear Contraseña</DialogTitle>
                            <DialogDescription>
                              Nueva contraseña para {user.name || user.email}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-2">
                            <Label>Nueva Contraseña</Label>
                            <Input
                              type="password"
                              value={resetPassword}
                              onChange={(e) => setResetPassword(e.target.value)}
                              placeholder="Mínimo 8 caracteres"
                              minLength={8}
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setResetUserId(null)}>Cancelar</Button>
                            <Button
                              onClick={() => resetPasswordMutation.mutate({ id: user.id, newPassword: resetPassword })}
                              disabled={resetPassword.length < 8 || resetPasswordMutation.isPending}
                            >
                              {resetPasswordMutation.isPending ? "Guardando..." : "Guardar"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("¿Está seguro de eliminar este usuario?")) {
                            deleteMutation.mutate({ id: user.id });
                          }
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
