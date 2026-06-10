// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";

function wrapInProvider(comp: React.ReactElement) {
  return render(React.createElement(ConfigProvider, null, comp));
}

describe("StockAlert", () => {
  beforeEach(() => { cleanup(); });

  it("renders nothing when lowStock is empty", async () => {
    const storeMod = await import("../src/stores/inventory-store");
    storeMod.useInventoryStore.setState({ lowStock: [] });
    const compMod = await import("../src/components/inventory/StockAlert");
    const { container } = wrapInProvider(React.createElement(compMod.default));
    expect(container.innerHTML).toBe("");
  });

  it("renders alert when lowStock has items", async () => {
    const storeMod = await import("../src/stores/inventory-store");
    storeMod.useInventoryStore.setState({
      lowStock: [{ "id": "inv2", "product_id": "p2", "warehouse_id": "w1", "sku": "SKU-002", "product_name": "Another Product", "warehouse_name": "Main", "warehouse_type": "domestic", "available": 5, "reserved": 0, "in_transit": 0, "safety_stock": 50, "updated_at": "2025-06-04" }],
    });
    const compMod = await import("../src/components/inventory/StockAlert");
    wrapInProvider(React.createElement(compMod.default));
    expect(screen.getByText(/SKU-002/)).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });
});

describe("ImportExcel", () => {
  beforeEach(() => { cleanup(); });
  it("renders the import button", async () => {
    const compMod = await import("../src/components/shared/ImportExcel");
    wrapInProvider(React.createElement(compMod.default, { platformCode: "temu", platformName: "Temu", onImported: () => {} }));
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});

describe("MetricCard", () => {
  beforeEach(() => { cleanup(); });
  it("renders with title and value", async () => {
    const compMod = await import("../src/components/dashboard/MetricCard");
    wrapInProvider(React.createElement(compMod.default, { title: "Revenue", value: 1500, prefix: "$" }));
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });
});

describe("Header", () => {
  beforeEach(() => { cleanup(); });
  it("renders the sync button", async () => {
    const compMod = await import("../src/components/layout/Header");
    const { container } = wrapInProvider(React.createElement(compMod.default));
    expect(container.querySelector(".anticon-sync")).toBeInTheDocument();
  });
  it("renders the notification bell", async () => {
    const compMod = await import("../src/components/layout/Header");
    const { container } = wrapInProvider(React.createElement(compMod.default));
    expect(container.querySelector(".anticon-bell")).toBeInTheDocument();
  });
});
