"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LogKind = "sent" | "received" | "system" | "error";
type ConnState =
  | "connecting"
  | "connected"
  | "closed"
  | "error"
  | "unsupported";

interface LogEntry {
  id: number;
  time: string;
  kind: LogKind;
  text: string;
}

const KIND_META: Record<LogKind, { tag: string; className: string }> = {
  sent: { tag: "→ ส่ง", className: "text-[#34E5C4]" },
  received: { tag: "← รับ", className: "text-[#5FA8FF]" },
  system: { tag: "• ระบบ", className: "text-[#6B7680]" },
  error: { tag: "! ผิดพลาด", className: "text-[#FF5C5C]" },
};

const STATUS_META: Record<
  ConnState,
  { label: string; color: string; pulse: boolean }
> = {
  connecting: { label: "กำลังเชื่อมต่อ", color: "#FFB454", pulse: true },
  connected: { label: "เชื่อมต่อแล้ว", color: "#34E5C4", pulse: true },
  closed: { label: "ปิดการเชื่อมต่อ", color: "#6B7680", pulse: false },
  error: { label: "เชื่อมต่อไม่สำเร็จ", color: "#FF5C5C", pulse: false },
  unsupported: {
    label: "เบราว์เซอร์ไม่รองรับ",
    color: "#FF5C5C",
    pulse: false,
  },
};

export default function Home() {
  // eslint-disable-next-line no-restricted-syntax
  const socketUrl = "ws://192.168.1.101:1888/ws/test";
  const socketRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);

  const [status, setStatus] = useState<ConnState>("connecting");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastDestination, setLastDestination] = useState<"LM9" | "AP4" | null>(
    null,
  );

  const pushLog = useCallback((kind: LogKind, text: string) => {
    idRef.current += 1;
    const time = new Date().toLocaleTimeString("th-TH", { hour12: false });
    setLogs((prev) => [
      ...prev.slice(-49),
      { id: idRef.current, time, kind, text },
    ]);
  }, []);

  const connectSocket = useCallback(() => {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      setStatus("unsupported");
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus("connecting");
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus("connected");
      pushLog("system", "เชื่อมต่อสำเร็จ");
      socket.send("hello from next.js");
      pushLog("sent", "hello from next.js");
    });

    socket.addEventListener("message", (event) => {
      pushLog("received", String(event.data));
    });

    socket.addEventListener("close", () => {
      setStatus("closed");
      pushLog("system", "ปิดการเชื่อมต่อ");
    });

    socket.addEventListener("error", () => {
      setStatus("error");
      pushLog("error", "เชื่อมต่อไม่สำเร็จ");
    });
  }, [socketUrl, pushLog]);

  useEffect(() => {
    connectSocket();
    return () => {
      socketRef.current?.close();
    };
  }, [connectSocket]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [logs]);

  const sendMessage = (msg: string, destination?: "LM9" | "AP4") => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(msg);
      pushLog("sent", msg);
      if (destination) setLastDestination(destination);
    } else {
      pushLog("error", "ยังไม่ได้เชื่อมต่อ ไม่สามารถส่งคำสั่งได้");
    }
  };

  const s = STATUS_META[status];
  const trackPercent =
    lastDestination === "LM9" ? 50 : lastDestination === "AP4" ? 100 : 0;

  return (
    <main className="min-h-screen bg-[#0A0E12] px-4 py-8 text-[#E8EDF1] md:px-10 md:py-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#232B33] pb-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#6B7680]">
              Fleet Control · Unit 01
            </p>
            <h1
              className="mt-1 text-2xl font-bold tracking-tight md:text-3xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              หน่วยควบคุมหุ่นยนต์ AMR
            </h1>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-[#232B33] bg-[#12171D] py-2 pl-3 pr-4">
            <span className="relative flex h-2.5 w-2.5">
              {s.pulse && (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                  style={{ backgroundColor: s.color }}
                />
              )}
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
            </span>
            <span className="text-sm font-medium" style={{ color: s.color }}>
              {s.label}
            </span>
            <span className="hidden border-l border-[#232B33] pl-3 font-mono text-xs text-[#4A535C] md:inline">
              {socketUrl}
            </span>
          </div>
        </header>

        {/* Route track — signature element: shows the last destination actually commanded */}
        <section className="mb-6 rounded-2xl border border-[#232B33] bg-[#12171D] p-6">
          <p className="mb-8 font-mono text-[11px] uppercase tracking-[0.3em] text-[#6B7680]">
            เส้นทางล่าสุด
          </p>
          <div className="relative px-4">
            <div className="absolute left-4 right-4 top-2.5 h-px bg-[#232B33]" />
            <div
              className="absolute top-2.5 h-px bg-[#34E5C4] transition-all duration-500 ease-out"
              style={{
                left: "1rem",
                width: `calc(${trackPercent}% - ${trackPercent === 0 ? "0px" : "1.5rem"})`,
              }}
            />
            <div
              className="absolute -top-4 flex -translate-x-1/2 flex-col items-center transition-all duration-500 ease-out"
              style={{
                left: `calc(${trackPercent}% * 1)`,
                transform: "translateX(-50%)",
              }}
            >
              <span className="text-[#34E5C4]">▾</span>
            </div>
            <div className="flex items-center justify-between">
              {[
                { key: null, label: "จุดเริ่มต้น" },
                { key: "LM9" as const, label: "LM9" },
                { key: "AP4" as const, label: "AP4" },
              ].map((node) => {
                const active = lastDestination === node.key;
                return (
                  <div
                    key={node.label}
                    className="flex flex-col items-center gap-2"
                  >
                    <span
                      className={`h-5 w-5 rounded-full border-2 transition-colors ${
                        active
                          ? "border-[#34E5C4] bg-[#34E5C4]/20"
                          : "border-[#2E3742] bg-[#0D1116]"
                      }`}
                    />
                    <span
                      className={`font-mono text-xs ${active ? "text-[#34E5C4]" : "text-[#6B7680]"}`}
                    >
                      {node.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Controls + Console */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-6">
            {/* Navigate */}
            <section className="rounded-2xl border border-[#232B33] bg-[#12171D] p-6">
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-[#6B7680]">
                นำทางไปยังสถานี
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendMessage("LM9", "LM9")}
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                    lastDestination === "LM9"
                      ? "border-[#34E5C4] bg-[#34E5C4]/10"
                      : "border-[#232B33] bg-[#0D1116] hover:border-[#34E5C4]/50"
                  }`}
                >
                  <span className="block font-mono text-xl font-bold">LM9</span>
                  <span className="text-xs text-[#6B7680]">สถานี LM9</span>
                </button>
                <button
                  onClick={() => sendMessage("AP4", "AP4")}
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                    lastDestination === "AP4"
                      ? "border-[#34E5C4] bg-[#34E5C4]/10"
                      : "border-[#232B33] bg-[#0D1116] hover:border-[#34E5C4]/50"
                  }`}
                >
                  <span className="block font-mono text-xl font-bold">AP4</span>
                  <span className="text-xs text-[#6B7680]">สถานี AP4</span>
                </button>
              </div>
            </section>

            {/* Actions */}
            <section className="rounded-2xl border border-[#232B33] bg-[#12171D] p-6">
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-[#6B7680]">
                คำสั่งงาน
              </h2>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendMessage("Load")}
                  className="rounded-xl bg-[#34E5C4] px-4 py-3 font-semibold text-[#062A24] transition-colors hover:bg-[#2BCDB0]"
                >
                  Load
                </button>
                <button
                  onClick={() => sendMessage("Unload")}
                  className="rounded-xl border border-[#FFB454] px-4 py-3 font-semibold text-[#FFB454] transition-colors hover:bg-[#FFB454]/10"
                >
                  Unload
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendMessage("AP4 then Load", "AP4")}
                  className="rounded-xl border border-[#232B33] bg-[#0D1116] px-4 py-3 text-sm text-[#C7D0D8] transition-colors hover:border-[#34E5C4]/50"
                >
                  ไป AP4 แล้ว Load
                </button>
                <button
                  onClick={() => sendMessage("AP4 then Unload", "AP4")}
                  className="rounded-xl border border-[#232B33] bg-[#0D1116] px-4 py-3 text-sm text-[#C7D0D8] transition-colors hover:border-[#FFB454]/50"
                >
                  ไป AP4 แล้ว Unload
                </button>
              </div>
            </section>

            {/* Utility row */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={connectSocket}
                className="rounded-full border border-[#232B33] px-4 py-2 text-sm text-[#C7D0D8] transition-colors hover:border-[#5FA8FF]/50 hover:text-[#5FA8FF]"
              >
                เชื่อมต่อใหม่
              </button>
              <button
                onClick={() => sendMessage("hello from next.js")}
                className="rounded-full border border-[#232B33] px-4 py-2 text-sm text-[#6B7680] transition-colors hover:border-[#6B7680]"
              >
                ส่งข้อความทดสอบ
              </button>
            </div>
          </div>

          {/* Console */}
          <section className="flex h-[420px] flex-col rounded-2xl border border-[#232B33] bg-[#0D1116] lg:h-auto">
            <div className="flex items-center justify-between border-b border-[#232B33] px-4 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#6B7680]">
                Log
              </span>
              <span className="font-mono text-xs text-[#4A535C]">
                {logs.length} รายการ
              </span>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed">
              {logs.length === 0 ? (
                <p className="text-[#4A535C]">
                  ยังไม่มีข้อความ — คำสั่งและข้อมูลจากหุ่นยนต์จะแสดงที่นี่
                </p>
              ) : (
                logs.map((entry) => {
                  const meta = KIND_META[entry.kind];
                  return (
                    <div key={entry.id} className="flex gap-2">
                      <span className="shrink-0 text-[#4A535C]">
                        {entry.time}
                      </span>
                      <span
                        className={`shrink-0 font-semibold ${meta.className}`}
                      >
                        {meta.tag}
                      </span>
                      <span className="break-all text-[#C7D0D8]">
                        {entry.text}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={logEndRef} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
