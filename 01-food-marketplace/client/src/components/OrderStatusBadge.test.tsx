import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderStatusBadge } from "./OrderStatusBadge";

describe("OrderStatusBadge", () => {
  it("communicates status with text, not colour alone", () => {
    render(<OrderStatusBadge status="pending" />);
    expect(screen.getByText("Order received")).toBeInTheDocument();
  });

  it("renders packed and falls back safely for unknown values", () => {
    const { rerender } = render(<OrderStatusBadge status="packed" />);
    expect(screen.getByText("Packed")).toBeInTheDocument();
    rerender(<OrderStatusBadge status="mystery" />);
    expect(screen.getByText("Status unavailable")).toBeInTheDocument();
  });
});
