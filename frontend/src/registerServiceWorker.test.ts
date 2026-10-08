import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./registerServiceWorker";

describe("registerServiceWorker", () => {
  afterEach(() => {
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
    vi.restoreAllMocks();
  });

  /** Gives jsdom a service worker container whose register() is a spy. */
  function stubServiceWorker(register = vi.fn().mockResolvedValue({})) {
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    return register;
  }

  /** Runs registerServiceWorker and returns the "load" handler it installed, if any. */
  function installedLoadHandler(enabled: boolean): (() => void) | undefined {
    const addListener = vi.spyOn(window, "addEventListener").mockImplementation(() => {});
    registerServiceWorker(enabled);
    const call = addListener.mock.calls.find(([type]) => type === "load");
    return call?.[1] as (() => void) | undefined;
  }

  it("registers /sw.js after the page has loaded", () => {
    const register = stubServiceWorker();
    const onLoad = installedLoadHandler(true);
    expect(register).not.toHaveBeenCalled();

    onLoad!();

    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("does nothing when disabled, as in the dev server and tests", () => {
    const register = stubServiceWorker();

    expect(installedLoadHandler(false)).toBeUndefined();
    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing in browsers without service workers", () => {
    expect(installedLoadHandler(true)).toBeUndefined();
  });

  it("only warns when registration fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubServiceWorker(vi.fn().mockRejectedValue(new Error("blocked")));

    installedLoadHandler(true)!();

    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  });
});
