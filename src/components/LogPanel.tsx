import { LogEntry } from "@/core/interface/log";
import { LOG } from "@/core/types/log";

interface LogPanelProps {
  logs: LogEntry[];
  logEndRef: React.RefObject<HTMLDivElement | null>;
}

const formatLogLine = (log: LogEntry) =>
  `[${log.time}] ${LOG[log.kind]} ${log.text}`;

export function LogPanel({ logs, logEndRef }: Readonly<LogPanelProps>) {
  return (
    <section className="flex flex-1 flex-col bg-black text-white">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-700 px-3 py-2">
        <span className="font-mono text-[0.7em] uppercase tracking-[0.3em]">
          Log
        </span>
        <span className="font-mono text-[0.7em]">{logs.length} Records</span>
      </div>
      <div className="flex-1 space-y-1 overflow-y-scroll px-3 py-2 font-mono text-[0.65em]">
        {logs.length === 0 ? (
          <p className="text-neutral-500">Waiting...</p>
        ) : (
          logs.map((log) => <div key={log.id}>{formatLogLine(log)}</div>)
        )}
        <div ref={logEndRef} />
      </div>
    </section>
  );
}
