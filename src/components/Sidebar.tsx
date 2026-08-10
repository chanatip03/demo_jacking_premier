"use client";

import type { ReactNode } from "react";
import SpaceDashboardIcon from "@mui/icons-material/SpaceDashboard";
import ListAltIcon from "@mui/icons-material/ListAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import type { TabView } from "../types";

interface SidebarProps {
  tabName: string;
  activeView: TabView;
  onViewChange: (view: TabView) => void;
  statusColor: string;
  statusLabel: string;
  queueCount: number;
}

const NAV_ITEMS: { key: TabView; label: string; icon: ReactNode }[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: <SpaceDashboardIcon fontSize="small" />,
  },
  { key: "queue", label: "Queue", icon: <ListAltIcon fontSize="small" /> },
  { key: "setting", label: "Setting", icon: <SettingsIcon fontSize="small" /> },
];

export function Sidebar({
  tabName,
  activeView,
  onViewChange,
  statusColor,
  statusLabel,
  queueCount,
}: Readonly<SidebarProps>) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[#1F2933] bg-[#0B1220] text-white">
      <div className="flex flex-col gap-1 border-b border-[#1F2933] px-6 py-6">
        <h1 className="text-xl font-bold tracking-tight">AMR Controller</h1>
        <p className="truncate text-sm text-gray-400">{tabName}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onViewChange(item.key)}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-base transition-colors ${
              activeView === item.key
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              {item.icon}
              {item.label}
            </span>

            {item.key === "queue" && queueCount > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeView === item.key
                    ? "bg-white/20 text-white"
                    : "bg-amber-400/20 text-amber-300"
                }`}
              >
                {queueCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2 border-t border-[#1F2933] px-6 py-5">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: statusColor }}
        />
        <span className="text-sm font-medium" style={{ color: statusColor }}>
          {statusLabel}
        </span>
      </div>
    </aside>
  );
}
