import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

// ─── Protocol ─────────────────────────────────────────────────────────────────
//
// Node-RED → Gateway
//   { type: "register_nodered", noderedId: string }   — identify on connect
//   { topic: string, data: unknown }                   — push data to browsers
//   <any raw string>                                   — forwarded as-is to all browsers
//
// Gateway → Node-RED
//   { type: "registered", noderedId: string }
//   { type: "browser_subscribe", subscribe: string[] }
//   { type: "browser_command", payload: unknown }      — command from a browser
//
// Browser → Gateway
//   { subscribe: string[] }                            — topic subscription (existing)
//   { type: "browser_command", payload: unknown }      — explicit command envelope
//   <plain string>                                     — legacy command (forwarded as payload)
//
// Gateway → Browser
//   { topic: string, data: unknown }                   — forwarded Node-RED data (existing)
//   { type: "nodered_status", online: boolean }        — Node-RED presence event
//   { type: "error", message: string }                 — error feedback
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────────────────────

/** The single connected Node-RED instance (null when offline). */
let noderedSocket: WebSocket | null = null;
let noderedId = "";

/** All connected browser WebSocket sessions. */
const browsers = new Set<WebSocket>();

/** Track liveness for every connected socket (ping/pong). */
const alive = new WeakMap<WebSocket, boolean>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendJson(ws: WebSocket, payload: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastBrowsers(payload: object): void {
  const raw = JSON.stringify(payload);
  for (const ws of browsers) {
    if (ws.readyState === WebSocket.OPEN) ws.send(raw);
  }
}

function broadcastNoderedStatus(online: boolean): void {
  broadcastBrowsers({ type: "nodered_status", online, noderedId });
}

function forwardToNodered(payload: object | string): void {
  if (!noderedSocket || noderedSocket.readyState !== WebSocket.OPEN) return;
  noderedSocket.send(
    typeof payload === "string" ? payload : JSON.stringify(payload),
  );
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer();
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const remoteAddr = req.socket.remoteAddress ?? "unknown";
  alive.set(ws, true);

  ws.on("pong", () => alive.set(ws, true));

  ws.on("error", (err) =>
    console.error(`[WS] Error from ${remoteAddr}:`, err.message),
  );

  // ── First message determines identity ─────────────────────────────────────
  // We initially treat every connection as "unknown".
  // The first JSON message with type "register_nodered" promotes it to Node-RED.
  // Any other message (or no type field) keeps it as a browser.

  let roleResolved = false;

  const onMessage = (raw: Buffer | ArrayBuffer | Buffer[]) => {
    const text = raw.toString();

    // ── Detect Node-RED registration (first JSON message with register_nodered)
    if (!roleResolved) {
      roleResolved = true;
      let parsed: Record<string, unknown> | null = null;

      try {
        parsed = JSON.parse(text);
      } catch {
        /* not JSON – treat as browser */
      }

      if (parsed && parsed.type === "register_nodered") {
        handleNoderedConnect(ws, parsed);
        return;
      }

      // Not a registration — treat as browser
      browsers.add(ws);
      console.log(`[Browser] connected  (total=${browsers.size})`);
      // Inform this browser whether Node-RED is online
      sendJson(ws, { type: "nodered_status", online: noderedSocket !== null && noderedSocket.readyState === WebSocket.OPEN, noderedId });
      // Now process the first message as a browser message
      handleBrowserMessage(ws, text, parsed);
      return;
    }

    // ── Route subsequent messages by role ──────────────────────────────────
    if (ws === noderedSocket) {
      handleNoderedMessage(ws, text);
    } else if (browsers.has(ws)) {
      let parsed: Record<string, unknown> | null = null;
      try { parsed = JSON.parse(text); } catch { /* plain string */ }
      handleBrowserMessage(ws, text, parsed);
    }
  };

  ws.on("message", onMessage);

  ws.on("close", () => {
    if (ws === noderedSocket) {
      console.log(`[Node-RED] disconnected (id=${noderedId})`);
      noderedSocket = null;
      noderedId = "";
      broadcastNoderedStatus(false);
    } else if (browsers.has(ws)) {
      browsers.delete(ws);
      console.log(`[Browser] disconnected (total=${browsers.size})`);
    }
  });
});

// ─── Node-RED Handlers ────────────────────────────────────────────────────────

function handleNoderedConnect(
  ws: WebSocket,
  msg: Record<string, unknown>,
): void {
  // Reject duplicate Node-RED — close the old one first
  if (noderedSocket && noderedSocket !== ws) {
    console.warn("[Node-RED] New connection replacing old one");
    noderedSocket.close(1000, "Replaced by new Node-RED connection");
  }

  const id = String(msg.noderedId ?? "nodered");
  noderedSocket = ws;
  noderedId = id;

  console.log(`[Node-RED] registered (id=${id})`);
  sendJson(ws, { type: "registered", noderedId: id });
  broadcastNoderedStatus(true);
}

function handleNoderedMessage(ws: WebSocket, text: string): void {
  if (ws !== noderedSocket) return;

  // Try JSON first
  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON */ }

  if (parsed) {
    // Has a topic field → forward as-is to all browsers (existing format)
    if (parsed.topic !== undefined) {
      broadcastBrowsers(parsed as object);
      return;
    }

    // Other control messages from Node-RED
    switch (parsed.type) {
      default:
        // Forward unknown JSON to all browsers unchanged
        broadcastBrowsers(parsed as object);
    }
  } else {
    // Plain string → forward raw text to all browsers
    for (const bws of browsers) {
      if (bws.readyState === WebSocket.OPEN) bws.send(text);
    }
  }
}

// ─── Browser Handlers ─────────────────────────────────────────────────────────

function handleBrowserMessage(
  ws: WebSocket,
  text: string,
  parsed: Record<string, unknown> | null,
): void {
  if (!browsers.has(ws) && ws !== noderedSocket) {
    // Was registered as nodered — ignore
    return;
  }

  if (parsed) {
    // Subscription request → forward to Node-RED
    if (Array.isArray(parsed.subscribe)) {
      forwardToNodered({ type: "browser_subscribe", subscribe: parsed.subscribe });
      return;
    }

    // Explicit command envelope
    if (parsed.type === "browser_command") {
      forwardToNodered({ type: "browser_command", payload: parsed.payload });
      return;
    }

    // Unknown JSON → forward to Node-RED as a command
    forwardToNodered(parsed as object);
  } else {
    // Plain string (legacy: "pause", "resume", "speed=1.0", etc.)
    forwardToNodered({ type: "browser_command", payload: text });
  }
}

// ─── Keepalive / Heartbeat ────────────────────────────────────────────────────

const PING_INTERVAL_MS = 30_000;

const heartbeat = setInterval(() => {
  const allSockets: WebSocket[] = [...browsers];
  if (noderedSocket) allSockets.push(noderedSocket);

  for (const ws of allSockets) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, PING_INTERVAL_MS);

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function shutdown(): void {
  console.log("[Gateway] Shutting down…");
  clearInterval(heartbeat);
  wss.close(() => server.close(() => process.exit(0)));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ─── Listen ───────────────────────────────────────────────────────────────────

const PORT = Number(process.env.GATEWAY_PORT ?? 8080);

server.listen(PORT, () => {
  console.log(`[Gateway] Listening on :${PORT}/ws`);
  console.log("  ├─ Node-RED  → connect to ws://this-host:${PORT}/ws and send { type:'register_nodered', noderedId:'...' }");
  console.log("  └─ Browser   → connect to ws://this-host:${PORT}/ws and send { subscribe:[...] }");
});