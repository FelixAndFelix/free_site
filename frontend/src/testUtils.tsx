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
 * Waits for the home screen line "Logged in as <username>", which spans several elements.
 * @param {string} username
 */
export function findLoggedInAs(username: string) {
  return screen.findByText((_, element) => element?.tagName === "P" && element.textContent?.startsWith(`Logged in as ${username}`) === true);
}
