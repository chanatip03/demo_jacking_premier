"use client";

import { useState } from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import {
  JackSettings,
  JackConfig,
  JackOperation,
  DEFAULT_JACK_SETTINGS,
} from "@/core/interface/jack";

interface JackConfigFormProps {
  label: string;
  config: JackConfig;
  recFiles: string[];
  onChange: (updated: JackConfig) => void;
}

function JackConfigForm({
  label,
  config,
  recFiles,
  onChange,
}: Readonly<JackConfigFormProps>) {
  return (
    <div className={`flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <span
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-widest`}
        >
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
          className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-gray-300 focus:bg-white focus:ring-2`}
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
          className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-gray-300 focus:bg-white focus:ring-2`}
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
            className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-gray-300 focus:bg-white focus:ring-2`}
          >
            <option value="">— None —</option>
            {recFiles.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="text-sm italic text-gray-400">
              No rec files available
            </span>
          </div>
        )}
      </div>

      {/* RECOGNIZE */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-800">Recognize</span>
          <span className="text-xs text-gray-400">
            Enable visual recognition
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...config, recognize: !config.recognize })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            config.recognize ? "bg-blue-500" : "bg-gray-300"
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
            className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-7 py-5">
              <div className="flex items-center gap-3">
                <SettingsIcon
                  sx={{
                    fontSize: {
                      sm: 18,
                      md: 28,
                      lg: 32,
                    },
                    color: "gray-900",
                  }}
                />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <CloseIcon style={{ fontSize: 18 }} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-gray-50/60 p-7">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <JackConfigForm
                  label="Jack Load"
                  config={settings.jackLoad}
                  recFiles={recFiles}
                  onChange={(updated) =>
                    setSettings((prev) => ({ ...prev, jackLoad: updated }))
                  }
                />
                <JackConfigForm
                  label="Jack Unload"
                  config={settings.jackUnload}
                  recFiles={recFiles}
                  onChange={(updated) =>
                    setSettings((prev) => ({ ...prev, jackUnload: updated }))
                  }
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-7 py-4">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-red-300 px-5 py-2 text-sm font-semibold shadow-sm transition-all bg-red-500 text-white hover:bg-red-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold shadow-sm transition-all border-emerald-400 bg-emerald-500 hover:bg-emerald-600 text-white"
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
