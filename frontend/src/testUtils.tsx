import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { App } from "./App";
import { AuthProvider } from "./auth";

export type Reply = { status: number; body?: object };

/**
 * Replaces fetch with fixed replies per "METHOD path"; unlisted requests answer 401.
 * @param {Record<string, Reply>} replies
 */
export function mockApi(replies: Record<string, Reply>) {
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const { status, body = {} } = replies[`${init?.method ?? "GET"} ${path}`] ?? {
      status: 401,
      body: { error: "unauthenticated" },
    };
    return { ok: status < 400, status, json: async () => body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * Returns the parsed JSON bodies of all calls to "METHOD path".
 * @param {ReturnType<typeof mockApi>} fetchMock
 * @param {string} method
 * @param {string} path
 */
export function sentBodies(fetchMock: ReturnType<typeof mockApi>, method: string, path: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([calledPath, init]) => calledPath === path && (init?.method ?? "GET") === method)
    .map(([, init]) => JSON.parse((init?.body as string | undefined) ?? "null"));
}

/**
 * Renders the app at a path.
 * @param {string} path
 */
export function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/**
 * Types a value into the input with the given label.
 * @param {RegExp} label
 * @param {string} value
 */
export function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/**
 * Waits for the account link with the username in the app bar, which appears once a user is logged in.
 * @param {string} username
 */
export function findLoggedInAs(username: string) {
  return screen.findByRole("link", { name: `${username} (account)` });
}

/** Stand-in for the browser's EventSource that tests can push server-sent events through. */
export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  private listeners = new Map<string, Array<(event: MessageEvent) => void>>();

  /**
   * Registers the instance so tests can find it.
   * @param {string} url
   */
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  /**
   * Stores a listener for a named event.
   * @param {string} type
   * @param {(event: MessageEvent) => void} listener
   */
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  /** Marks the stream as closed. */
  close() {
    this.closed = true;
  }

  /**
   * Delivers an event to the listeners of its type, like the server would.
   * @param {string} type
   * @param {object} [data]
   */
  emit(type: string, data?: object) {
    const event = new MessageEvent(type, { data: data === undefined ? undefined : JSON.stringify(data) });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  /** Installs the fake as the global EventSource and forgets earlier instances. */
  static install() {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  }

  /** The most recently opened stream that is still open. */
  static latest(): FakeEventSource {
    const open = FakeEventSource.instances.filter((source) => !source.closed);
    return open.at(-1)!;
  }
}
