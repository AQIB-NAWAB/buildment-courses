import { describe, expect, it } from "vitest";
import { formatMoney, nextStatus, statusLabel } from "./utils";

describe("money formatting", () => {
  it("formats minor units without losing paise", () => {
    expect(formatMoney(12345)).toContain("123.45");
    expect(formatMoney(0)).toContain("0.00");
  });
});

describe("order status presentation", () => {
  it("uses human labels for fulfilment states", () => {
    expect(statusLabel("pending")).toBe("Order received");
    expect(statusLabel("packed")).toBe("Packed");
    expect(statusLabel("dispatched")).toBe("Dispatched");
    expect(statusLabel("something-unknown")).toBe("Status unavailable");
  });

  it("only advances one fulfilment step at a time", () => {
    expect(nextStatus("pending")).toBe("packed");
    expect(nextStatus("packed")).toBe("dispatched");
    expect(nextStatus("dispatched")).toBeNull();
  });
});
