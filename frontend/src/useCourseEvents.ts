import { useEffect, useRef } from "react";
import type { CourseEvent } from "@free-site/shared";

type EventHandler = (event: CourseEvent) => void;

/**
 * Follows the live updates of the user's course (server-sent events on /api/events) while the
 * component is mounted. The browser reconnects by itself; after a reconnect onReconnect runs,
 * so the page can reload anything it missed while the connection was down.
 * @param {EventHandler} onEvent
 * @param {() => void} onReconnect
 */
export function useCourseEvents(onEvent: EventHandler, onReconnect: () => void) {
  // Refs, so a new handler on every render neither reopens the connection nor calls a stale one.
  const handlers = useRef({ onEvent, onReconnect });
  handlers.current = { onEvent, onReconnect };

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource("/api/events");
    let connectedBefore = false;
    const handle = (message: MessageEvent<string>) => handlers.current.onEvent(JSON.parse(message.data) as CourseEvent);

    source.addEventListener("module-votes", handle);
    source.addEventListener("modules-changed", handle);
    source.addEventListener("open", () => {
      if (connectedBefore) handlers.current.onReconnect();
      connectedBefore = true;
    });
    return () => source.close();
  }, []);
}
