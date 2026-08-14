"use client";

import { useState, useEffect } from "react";
import { useRobot } from "@/providers/robot.provider";
import SettingsIcon from "@mui/icons-material/Settings";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  JackSettings,
  JackConfig,
  JackOperation,
  DEFAULT_JACK_SETTINGS,
} from "@/core/interface/jack";

const STORAGE_KEY = "jack_settings";

function loadFromStorage(): JackSettings {
  try {
    if (typeof window === "undefined") return DEFAULT_JACK_SETTINGS;
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

interface JackConfigCardProps {
  label: string;
  icon: React.ReactNode;
  accentClass: {
    card: string;
    badge: string;
    glow: string;
    toggle: string;
    ring: string;
    select: string;
  };
  config: JackConfig;
  recFiles: string[];
  onChange: (updated: JackConfig) => void;
}

function JackConfigCard({
  label,
  icon,
  accentClass,
  config,
  recFiles,
  onChange,
}: Readonly<JackConfigCardProps>) {
  return (
    <div
      className={`relative flex flex-col gap-6 rounded-3xl border p-7 shadow-xl backdrop-blur-md ${accentClass.card}`}
    >
      {/* Glow orb */}
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full blur-3xl opacity-20 ${accentClass.glow}`}
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${accentClass.badge}`}
        >
          {icon}
        </div>
        <h3 className="text-lg font-bold text-white">{label}</h3>
      </div>

      {/* POI */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          POI
        </label>
        <input
          id={`poi-${label.replace(/\s+/g, "-").toLowerCase()}`}
          type="text"
          value={config.poi}
          onChange={(e) => onChange({ ...config, poi: e.target.value })}
          placeholder="e.g. POI_A1"
          className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition focus:bg-white/10 focus:ring-2 ${accentClass.ring}`}
        />
      </div>

      {/* OPERATION */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Operation
        </label>
        <select
          id={`operation-${label.replace(/\s+/g, "-").toLowerCase()}`}
          value={config.operation}
          onChange={(e) =>
            onChange({ ...config, operation: e.target.value as JackOperation })
          }
          className={`w-full rounded-xl border border-white/10 bg-gray-800/80 px-4 py-3 text-sm text-white outline-none transition focus:ring-2 ${accentClass.select}`}
        >
          <option value="JackLoad">JackLoad</option>
          <option value="JackUnload">JackUnload</option>
        </select>
      </div>

      {/* RECFILE */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          REC File
        </label>
        {recFiles.length > 0 ? (
          <select
            id={`recfile-${label.replace(/\s+/g, "-").toLowerCase()}`}
            value={config.recFile}
            onChange={(e) => onChange({ ...config, recFile: e.target.value })}
            className={`w-full rounded-xl border border-white/10 bg-gray-800/80 px-4 py-3 text-sm text-white outline-none transition focus:ring-2 ${accentClass.select}`}
          >
            <option value="">— None —</option>
            {recFiles.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm italic text-gray-600">
              No rec files available (connect robot first)
            </span>
          </div>
        )}
      </div>

      {/* RECOGNIZE toggle */}
      <div
        className={`flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4`}
      >
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">Recognize</span>
          <span className="text-xs text-gray-500 mt-0.5">
            Enable visual recognition on arrival
          </span>
        </div>
        <button
          id={`recognize-${label.replace(/\s+/g, "-").toLowerCase()}`}
          type="button"
          role="switch"
          aria-checked={config.recognize}
          onClick={() => onChange({ ...config, recognize: !config.recognize })}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ${
            config.recognize ? accentClass.toggle : "bg-gray-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
              config.recognize ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export default function SettingPage() {
  const { rec_file } = useRobot();
  const [settings, setSettings] = useState<JackSettings>(DEFAULT_JACK_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadFromStorage());
  }, []);

  const handleSave = () => {
    saveToStorage(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const jackLoadAccent = {
    card: "border-blue-500/30 bg-gradient-to-br from-gray-900 to-blue-950/40",
    badge: "border-blue-400/40 bg-blue-500/20 text-blue-300",
    glow: "bg-blue-500",
    toggle: "bg-blue-500",
    ring: "focus:ring-blue-500/40",
    select: "focus:ring-blue-500/40",
  };

  const jackUnloadAccent = {
    card: "border-violet-500/30 bg-gradient-to-br from-gray-900 to-violet-950/40",
    badge: "border-violet-400/40 bg-violet-500/20 text-violet-300",
    glow: "bg-violet-500",
    toggle: "bg-violet-500",
    ring: "focus:ring-violet-500/40",
    select: "focus:ring-violet-500/40",
  };

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Page Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30">
            <SettingsIcon style={{ color: "white", fontSize: 22 }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-gray-400">
              Configure Jack Load &amp; Jack Unload parameters
            </p>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <JackConfigCard
            label="Jack Load"
            icon={
              <ElectricBoltIcon style={{ fontSize: 18, color: "#60a5fa" }} />
            }
            accentClass={jackLoadAccent}
            config={settings.jackLoad}
            recFiles={rec_file}
            onChange={(updated) =>
              setSettings((prev) => ({ ...prev, jackLoad: updated }))
            }
          />
          <JackConfigCard
            label="Jack Unload"
            icon={
              <ElectricBoltIcon style={{ fontSize: 18, color: "#a78bfa" }} />
            }
            accentClass={jackUnloadAccent}
            config={settings.jackUnload}
            recFiles={rec_file}
            onChange={(updated) =>
              setSettings((prev) => ({ ...prev, jackUnload: updated }))
            }
          />
        </div>

        {/* JSON Preview */}
        <div className="mt-8 rounded-2xl border border-white/5 bg-black/60 p-6 backdrop-blur-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            JSON Preview — sent when action button is triggered
          </p>
          <pre className="overflow-x-auto text-xs leading-relaxed text-emerald-400">
            {JSON.stringify(
              {
                jackLoad: settings.jackLoad,
                jackUnload: settings.jackUnload,
              },
              null,
              2,
            )}
          </pre>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            id="save-jack-settings"
            type="button"
            onClick={handleSave}
            className={`flex items-center gap-2 rounded-2xl px-8 py-3 text-sm font-bold shadow-lg transition-all duration-300 ${
              saved
                ? "bg-emerald-500 text-white shadow-emerald-500/30"
                : "bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-blue-500/30 hover:from-blue-600 hover:to-violet-700 hover:shadow-violet-500/30"
            }`}
          >
            {saved ? (
              <>
                <CheckCircleIcon style={{ fontSize: 18 }} />
                Saved!
              </>
            ) : (
              <>
                <SaveIcon style={{ fontSize: 18 }} />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
