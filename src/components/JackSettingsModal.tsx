"use client";

import { useState } from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import {
  JackSettings,
  JackConfig,
  JackOperation,
  DEFAULT_JACK_SETTINGS,
} from "@/core/interface/jack";

interface JackConfigFormProps {
  label: string;
  accentColor: "blue" | "violet";
  config: JackConfig;
  recFiles: string[];
  onChange: (updated: JackConfig) => void;
}

function JackConfigForm({
  label,
  accentColor,
  config,
  recFiles,
  onChange,
}: Readonly<JackConfigFormProps>) {
  const accent =
    accentColor === "blue"
      ? {
          border: "border-blue-500",
          title: "text-blue-400",
          badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
          toggle: "bg-blue-500",
          select: "focus:ring-blue-500/40 focus:border-blue-400",
        }
      : {
          border: "border-violet-500",
          title: "text-violet-400",
          badge: "bg-violet-500/20 text-violet-300 border-violet-500/40",
          toggle: "bg-violet-500",
          select: "focus:ring-violet-500/40 focus:border-violet-400",
        };

  return (
    <div
      className={`flex flex-col gap-5 rounded-2xl border ${accent.border}/40 bg-white/5 p-6 backdrop-blur-sm`}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <span
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold uppercase tracking-widest ${accent.badge}`}
        >
          <ElectricBoltIcon style={{ fontSize: 13 }} />
          {label}
        </span>
      </div>

      {/* POI */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          POI
        </label>
        <input
          type="text"
          value={config.poi}
          onChange={(e) => onChange({ ...config, poi: e.target.value })}
          placeholder="e.g. POI_A1"
          className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-white/20 focus:ring-2 ${accent.select}`}
        />
      </div>

      {/* OPERATION */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Operation
        </label>
        <select
          value={config.operation}
          onChange={(e) =>
            onChange({ ...config, operation: e.target.value as JackOperation })
          }
          className={`w-full rounded-xl border border-white/10 bg-gray-800 px-4 py-2.5 text-sm text-white outline-none transition focus:border-white/20 focus:ring-2 ${accent.select}`}
        >
          <option value="JackLoad">JackLoad</option>
          <option value="JackUnload">JackUnload</option>
        </select>
      </div>

      {/* RECFILE */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          REC File
        </label>
        {recFiles.length > 0 ? (
          <select
            value={config.recFile}
            onChange={(e) => onChange({ ...config, recFile: e.target.value })}
            className={`w-full rounded-xl border border-white/10 bg-gray-800 px-4 py-2.5 text-sm text-white outline-none transition focus:border-white/20 focus:ring-2 ${accent.select}`}
          >
            <option value="">— None —</option>
            {recFiles.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
            <span className="text-sm text-gray-500 italic">
              No rec files available
            </span>
          </div>
        )}
      </div>

      {/* RECOGNIZE */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">Recognize</span>
          <span className="text-xs text-gray-500">
            Enable visual recognition
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...config, recognize: !config.recognize })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            config.recognize ? accent.toggle : "bg-gray-600"
          }`}
          role="switch"
          aria-checked={config.recognize}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              config.recognize ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

/* ── Storage helpers ── */
const STORAGE_KEY = "jack_settings";

function loadFromStorage(): JackSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_JACK_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_JACK_SETTINGS;
}

function saveToStorage(settings: JackSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/* ── Public hook to read saved jack settings ── */
export function loadJackSettings(): JackSettings {
  return loadFromStorage();
}

/* ── Main modal component ── */
interface JackSettingsModalProps {
  recFiles: string[];
}

export function JackSettingsModal({
  recFiles,
}: Readonly<JackSettingsModalProps>) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<JackSettings>(loadFromStorage);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveToStorage(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClose = () => {
    setSettings(loadFromStorage());
    setOpen(false);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          setSettings(loadFromStorage());
          setOpen(true);
        }}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-800 active:scale-95 transition-all"
        title="Jack Settings"
      >
        <SettingsIcon style={{ fontSize: 16 }} />
        Jack Settings
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-gray-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-7 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600">
                  <SettingsIcon style={{ fontSize: 18, color: "white" }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Jack Settings
                  </h2>
                  <p className="text-xs text-gray-400">
                    Configure Jack Load &amp; Unload parameters
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <CloseIcon style={{ fontSize: 18 }} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-7">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <JackConfigForm
                  label="Jack Load"
                  accentColor="blue"
                  config={settings.jackLoad}
                  recFiles={recFiles}
                  onChange={(updated) =>
                    setSettings((prev) => ({ ...prev, jackLoad: updated }))
                  }
                />
                <JackConfigForm
                  label="Jack Unload"
                  accentColor="violet"
                  config={settings.jackUnload}
                  recFiles={recFiles}
                  onChange={(updated) =>
                    setSettings((prev) => ({ ...prev, jackUnload: updated }))
                  }
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-7 py-4">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-white/10 px-5 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
                  saved
                    ? "bg-emerald-500 text-white"
                    : "bg-gradient-to-r from-blue-500 to-violet-600 text-white hover:from-blue-600 hover:to-violet-700"
                }`}
              >
                <SaveIcon style={{ fontSize: 16 }} />
                {saved ? "Saved!" : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
