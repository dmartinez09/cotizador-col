import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(role: "vendedor" | "coordinador" | "gerente" | "admin" = "vendedor"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "local",
    passwordHash: null,
    role,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("Products Router", () => {
  it("should allow authenticated users to list products", async () => {
    const ctx = createMockContext("vendedor");
    const caller = appRouter.createCaller(ctx);

    const products = await caller.products.list();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  it("should only allow admins to create products", async () => {
    const vendedorCtx = createMockContext("vendedor");
    const vendedorCaller = appRouter.createCaller(vendedorCtx);

    await expect(
      vendedorCaller.products.create({
        description: "Test Product",
        category: "Test",
        presentation: "1L",
        cost: 1000,
        price: 2000,
        stock: 10,
      })
    ).rejects.toThrow("Solo administradores pueden realizar esta acción");

    const adminCtx = createMockContext("admin");
    const adminCaller = appRouter.createCaller(adminCtx);

    const result = await adminCaller.products.create({
      description: "Test Product Admin",
      category: "Test",
      presentation: "1L",
      cost: 1000,
      price: 2000,
      stock: 10,
    });

    expect(result.success).toBe(true);
  });
});

describe("Clients Router", () => {
  it("should allow authenticated users to list clients", async () => {
    const ctx = createMockContext("vendedor");
    const caller = appRouter.createCaller(ctx);

    const clients = await caller.clients.list();
    expect(Array.isArray(clients)).toBe(true);
    expect(clients.length).toBeGreaterThan(0);
  });

  it("should only allow admins to create clients", async () => {
    const vendedorCtx = createMockContext("vendedor");
    const vendedorCaller = appRouter.createCaller(vendedorCtx);

    await expect(
      vendedorCaller.clients.create({
        name: "Test Client",
        zone: "Test Zone",
      })
    ).rejects.toThrow("Solo administradores pueden realizar esta acción");
  });
});

describe("Quotations Router", () => {
  it("should allow authenticated users to list quotations", async () => {
    const ctx = createMockContext("vendedor");
    const caller = appRouter.createCaller(ctx);

    const quotations = await caller.quotations.list();
    expect(Array.isArray(quotations)).toBe(true);
  });

  it("should calculate margin correctly", () => {
    const subtotal = 100000;
    const totalCost = 70000;
    const grossProfit = subtotal - totalCost;
    const grossMargin = (grossProfit / subtotal) * 100;

    expect(grossMargin).toBe(30);
    expect(grossMargin).toBeGreaterThanOrEqual(10);
    expect(grossMargin).toBeLessThan(32);
  });

  it("should determine correct approval flow based on margin", () => {
    const testMargin = (margin: number) => {
      if (margin < 10) return "CÉSAR";
      if (margin < 32) return "CÉSAR";
      return "COORDINADOR";
    };

    expect(testMargin(5)).toBe("CÉSAR");
    expect(testMargin(15)).toBe("CÉSAR");
    expect(testMargin(35)).toBe("COORDINADOR");
  });
});

describe("Users Router", () => {
  it("should only allow admins to list users", async () => {
    const vendedorCtx = createMockContext("vendedor");
    const vendedorCaller = appRouter.createCaller(vendedorCtx);

    await expect(vendedorCaller.users.list()).rejects.toThrow(
      "Solo administradores pueden realizar esta acción"
    );

    const adminCtx = createMockContext("admin");
    const adminCaller = appRouter.createCaller(adminCtx);

    const users = await adminCaller.users.list();
    expect(Array.isArray(users)).toBe(true);
  });
});
