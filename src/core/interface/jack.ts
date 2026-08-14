export type JackOperation = "JackLoad" | "JackUnload";

export interface JackConfig {
  poi: string;
  operation: JackOperation;
  recognize: boolean;
  recFile: string;
}

export interface JackSettings {
  jackLoad: JackConfig;
  jackUnload: JackConfig;
}

export const DEFAULT_JACK_CONFIG: JackConfig = {
  poi: "",
  operation: "JackLoad",
  recognize: false,
  recFile: "",
};

export const DEFAULT_JACK_SETTINGS: JackSettings = {
  jackLoad: { ...DEFAULT_JACK_CONFIG, operation: "JackLoad" },
  jackUnload: { ...DEFAULT_JACK_CONFIG, operation: "JackUnload" },
};
