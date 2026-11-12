import { act, render, screen } from "@testing-library/react";
import { legacyCreateColumnHelper } from "@tanstack/react-table/legacy";
import { beforeEach, describe, expect, it } from "vitest";

import { columnVisibilityStore, setColumnVisibility } from "./column-visibility";
import { DataTable, type DataColumn } from "./data-table";

type Row = { id: string; name: string; email: string };

const columnHelper = legacyCreateColumnHelper<Row>();
const columns: DataColumn<Row>[] = [
  columnHelper.accessor("name", { header: () => "Name", cell: (info) => info.getValue() }),
  columnHelper.accessor("email", { header: () => "Email", cell: (info) => info.getValue() }),
];

const data: Row[] = [{ id: "1", name: "Alice", email: "alice@example.com" }];

beforeEach(() => {
  columnVisibilityStore.setState(() => ({}));
  localStorage.clear();
});

describe("DataTable", () => {
  it("renders headers and data rows", () => {
    render(
      <DataTable columns={columns} data={data} getRowId={(row) => row.id} tableKey="test.orders" />,
    );

    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
  });

  it("hides a column when the shared store marks it hidden", () => {
    act(() => setColumnVisibility("test.orders", { name: false }));

    render(
      <DataTable columns={columns} data={data} getRowId={(row) => row.id} tableKey="test.orders" />,
    );

    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.getByText("Email")).toBeTruthy();
  });
});
