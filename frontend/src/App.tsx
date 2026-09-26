import { useEffect, useState } from "react";
import type { HealthResponse } from "@free-site/shared";

/** Fetches the backend health once and returns a display message. */
function useHealthMessage(): string {
  const [message, setMessage] = useState("Backend: checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json() as Promise<HealthResponse>)
      .then(({ status, database }) =>
        setMessage(`Backend: ${status}, database ${database ? "connected" : "unreachable"}`),
      )
      .catch(() => setMessage("Backend: unreachable"));
  }, []);

  return message;
}

/** Root component of the walking skeleton. */
export function App() {
  return (
    <main>
      <h1>free_site</h1>
      <p>{useHealthMessage()}</p>
    </main>
  );
}
