import type { Response } from "express";
import type { CourseEvent } from "@free-site/shared";

// A few tabs per person is normal; more than this is most likely a script holding connections open.
const MAX_STREAMS_PER_USER = 5;
// Cloudflare closes connections idle for 100 s, so a comment line keeps the stream alive.
const HEARTBEAT_MS = 25_000;

interface Stream {
  userId: string;
  courseId: string;
  response: Response;
  heartbeat: ReturnType<typeof setInterval>;
}

/**
 * In-memory hub for server-sent events. Each open tab holds one stream subscribed to the course
 * of its user; events are published per course. In memory is fine for a single backend instance.
 */
export function createEventHub() {
  const streams = new Set<Stream>();

  /** Writes one event in the SSE wire format. */
  function write(response: Response, event: CourseEvent) {
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }

  /** Ends a stream and forgets it. */
  function close(stream: Stream) {
    clearInterval(stream.heartbeat);
    streams.delete(stream);
    stream.response.end();
  }

  /**
   * Starts an event stream on the response for a user of a course. Returns false (and writes
   * nothing) if the user already has the maximum number of open streams.
   */
  function subscribe(response: Response, userId: string, courseId: string): boolean {
    const own = [...streams].filter((stream) => stream.userId === userId);
    if (own.length >= MAX_STREAMS_PER_USER) return false;

    response.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tells nginx not to buffer this response, so events are delivered immediately.
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders();
    // Clients reconnect after 3 s if the connection drops, e.g. during a deploy.
    response.write("retry: 3000\n\n");

    const stream: Stream = {
      userId,
      courseId,
      response,
      heartbeat: setInterval(() => response.write(": keep-alive\n\n"), HEARTBEAT_MS),
    };
    streams.add(stream);
    response.on("close", () => {
      clearInterval(stream.heartbeat);
      streams.delete(stream);
    });
    return true;
  }

  /** Sends an event to every open stream of the course. */
  function publish(courseId: string, event: CourseEvent) {
    for (const stream of streams) if (stream.courseId === courseId) write(stream.response, event);
  }

  /** Closes a user's streams, e.g. after they were moved to another course; clients then reconnect. */
  function disconnectUser(userId: string) {
    for (const stream of [...streams]) if (stream.userId === userId) close(stream);
  }

  /** Number of open streams, for tests. */
  function size(): number {
    return streams.size;
  }

  return { subscribe, publish, disconnectUser, size };
}

export type EventHub = ReturnType<typeof createEventHub>;
