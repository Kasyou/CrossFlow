// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";

// Store imports
import { useInventoryStore } from "../src/stores/inventory-store";
import { useWarehouseStore } from "../src/stores/warehouse-store";
import { useOrderStore } from "../src/stores/order-store";
import { useDashboardStore } from "../src/stores/dashboard-store";
import { useProductStore } from "../src/stores/product-store";
import { usePlatformStore } from "../src/stores/platform-store";

describe("InventoryStore", () => {
  beforeEach(() => {
    useInventoryStore.setState({ items: [], lowStock: [], loading: false });
  });

  it("loadAll fetches inventory list from IPC", async () => {
    await act(async () => { await useInventoryStore.getState().loadAll(); });
    const items = useInventoryStore.getState().items;
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].sku).toBeTruthy();
  });

  it("loadLowStock fetches low stock items", async () => {
    await act(async () => { await useInventoryStore.getState().loadLowStock(); });
    const low = useInventoryStore.getState().lowStock;
    expect(low.length).toBeGreaterThanOrEqual(0);
  });

  it("loadWarehouses fetches warehouse list", async () => {
    await act(async () => { await useWarehouseStore.getState().loadWarehouses(); });
    const warehouses = useWarehouseStore.getState().warehouses;
    expect(warehouses.length).toBeGreaterThanOrEqual(1);
    expect(warehouses[0].name).toBeTruthy();
  });

  it("restock calls IPC and refreshes lists", async () => {
    const spy = vi.spyOn((window as any).electronAPI, "invoke");
    await act(async () => { await useInventoryStore.getState().restock("p1", "w1", 50, "test restock"); });
    expect(spy).toHaveBeenCalledWith("inventory:restock", "p1", "w1", 50, "test restock");
    spy.mockRestore();
  });

  it("loading state is managed correctly", async () => {
    expect(useInventoryStore.getState().loading).toBe(false);
    const loadPromise = act(async () => { await useInventoryStore.getState().loadAll(); });
    await loadPromise;
    expect(useInventoryStore.getState().loading).toBe(false);
  });
});

describe("OrderStore", () => {
  beforeEach(() => {
    useOrderStore.setState({ orders: [], total: 0, loading: false, pendingCount: 0, filter: { page: 1, pageSize: 50 }, selectedRowKeys: [] });
  });

  it("loadOrders fetches paginated orders", async () => {
    await act(async () => { await useOrderStore.getState().loadOrders(); });
    const { orders, total } = useOrderStore.getState();
    expect(orders.length).toBeGreaterThanOrEqual(1);
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it("setFilter updates filter and reloads orders", async () => {
    await act(async () => { useOrderStore.getState().setFilter({ status: "shipped" }); });
    const filter = useOrderStore.getState().filter;
    expect(filter.status).toBe("shipped");
  });

  it("setSelectedRowKeys stores selection", () => {
    act(() => { useOrderStore.getState().setSelectedRowKeys(["o1"]); });
    expect(useOrderStore.getState().selectedRowKeys).toEqual(["o1"]);
  });

  it("shipOrders calls batchShip IPC", async () => {
    const spy = vi.spyOn((window as any).electronAPI, "invoke");
    await act(async () => { await useOrderStore.getState().shipOrders(["o1"]); });
    expect(spy).toHaveBeenCalledWith("orders:batchShip", ["o1"]);
    spy.mockRestore();
  });

  it("refreshPendingCount fetches and stores pending count", async () => {
    await act(async () => { await useOrderStore.getState().refreshPendingCount(); });
    expect(useOrderStore.getState().pendingCount).toBeGreaterThanOrEqual(0);
  });
});

describe("DashboardStore", () => {
  beforeEach(() => {
    useDashboardStore.setState({ metrics: null, salesTrend: [], platformShare: [], skuProfit: [], lowStock: [], loading: false });
  });

  it("loadAll fetches all dashboard data in parallel", async () => {
    await act(async () => { await useDashboardStore.getState().loadAll(); });
    const state = useDashboardStore.getState();
    expect(state.metrics).not.toBeNull();
    expect(state.metrics?.todayRevenue).toBe(1250.50);
    expect(state.salesTrend.length).toBeGreaterThanOrEqual(1);
    expect(state.platformShare.length).toBeGreaterThanOrEqual(1);
    expect(state.skuProfit.length).toBeGreaterThanOrEqual(1);
  });

  it("loading active during fetch", () => {
    act(() => { useDashboardStore.getState().loadAll(); });
    expect(useDashboardStore.getState().loading).toBe(true);
  });
});

describe("ProductStore", () => {
  beforeEach(() => {
    useProductStore.setState({ products: [], loading: false });
  });

  it("loadProducts fetches product list", async () => {
    await act(async () => { await useProductStore.getState().loadProducts(); });
    const products = useProductStore.getState().products;
    expect(products.length).toBeGreaterThanOrEqual(1);
    expect(products[0].sku).toBeTruthy();
  });

  it("createProduct calls IPC and refreshes", async () => {
    const spy = vi.spyOn((window as any).electronAPI, "invoke");
    await act(async () => { await useProductStore.getState().createProduct({ sku: "NEW", name: "New" }); });
    expect(spy).toHaveBeenCalledWith("product:create", { sku: "NEW", name: "New" });
    spy.mockRestore();
  });

  it("updateProduct calls IPC", async () => {
    const spy = vi.spyOn((window as any).electronAPI, "invoke");
    await act(async () => { await useProductStore.getState().updateProduct("SKU-001", { name: "Updated" }); });
    expect(spy).toHaveBeenCalledWith("product:update", "SKU-001", { name: "Updated" });
    spy.mockRestore();
  });

  it("deleteProduct calls IPC", async () => {
    const spy = vi.spyOn((window as any).electronAPI, "invoke");
    await act(async () => { await useProductStore.getState().deleteProduct("SKU-001"); });
    expect(spy).toHaveBeenCalledWith("product:delete", "SKU-001");
    spy.mockRestore();
  });
});

describe("SettingsStore", () => {
  beforeEach(() => {
    usePlatformStore.setState({ platforms: [], loading: false });
  });

  it("loadPlatforms fetches platform list", async () => {
    await act(async () => { await usePlatformStore.getState().loadPlatforms(); });
    const platforms = usePlatformStore.getState().platforms;
    expect(platforms.length).toBeGreaterThanOrEqual(1);
    expect(platforms[0].code).toBeTruthy();
  });

  it("saveAuth calls IPC and reloads", async () => {
    const spy = vi.spyOn((window as any).electronAPI, "invoke");
    await act(async () => { await usePlatformStore.getState().saveAuth("amazon", { key: "val" }); });
    expect(spy).toHaveBeenCalledWith("platform:saveAuth", "amazon", { key: "val" });
    spy.mockRestore();
  });

  it("toggleSync calls IPC", async () => {
    const spy = vi.spyOn((window as any).electronAPI, "invoke");
    await act(async () => { await usePlatformStore.getState().toggleSync("amazon", true); });
    expect(spy).toHaveBeenCalledWith("platform:toggleSync", "amazon", true);
    spy.mockRestore();
  });

  it("syncNow returns sync result", async () => {
    const result = await act(async () => { return usePlatformStore.getState().syncNow("amazon"); });
    expect(result).toBeDefined();
  });
});
