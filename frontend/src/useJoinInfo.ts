import { useEffect, useState } from "react";
import type { ApiErrorCode, JoinInfoResponse } from "@free-site/shared";
import { apiRequest } from "./api";

export type JoinInfoState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; info: JoinInfoResponse }
  | { status: "failed"; error: ApiErrorCode };

/**
 * Looks up the course behind an invite link code. Without a code nothing is requested.
 * The membership in the answer depends on who is logged in, so it reloads when the user changes.
 * @param {string | null | undefined} code
 * @param {string | undefined} userId
 */
export function useJoinInfo(code: string | null | undefined, userId?: string): JoinInfoState {
  const [state, setState] = useState<JoinInfoState>({ status: code ? "loading" : "none" });

  useEffect(() => {
    if (!code) return setState({ status: "none" });
    let cancelled = false;
    setState({ status: "loading" });
    apiRequest<JoinInfoResponse>(`/api/join/${encodeURIComponent(code)}`).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "ready", info: result.data } : { status: "failed", error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [code, userId]);

  return state;
}
