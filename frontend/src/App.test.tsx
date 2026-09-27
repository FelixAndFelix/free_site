import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function mockHealth(body: object, ok = true) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: async () => body }));
}

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the backend and database as healthy", async () => {
    mockHealth({ status: "ok", database: true });
    render(<App />);
    expect(await screen.findByText("Backend: ok, database connected")).toBeInTheDocument();
  });

  it("shows a degraded state when the database is down", async () => {
    mockHealth({ status: "degraded", database: false }, false);
    render(<App />);
    expect(await screen.findByText("Backend: degraded, database unreachable")).toBeInTheDocument();
  });

  it("shows unreachable when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<App />);
    expect(await screen.findByText("Backend: unreachable")).toBeInTheDocument();
  });
});
