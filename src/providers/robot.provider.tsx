"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";

export interface FlowNode {
  id?: string;
  type?: string;
  label?: string;
  name?: string;
  z?: string;

  rules?: SwitchRule[];
  wires?: string[][];
  poi?: string;
  operation?: string;
  payload?: string;

  [key: string]: unknown;
}

export interface BatteryData {
  soc: number;
  is_charging: boolean;
}

export interface TaskData {
  id?: string;
  state?: string;
  target?: string;
}

export interface SwitchRule {
  t: string;
  v: string;
  vt: string;
}

export interface CurrentPOI {
  POI: string;
  LPOI: string;
  x: number;
  y: number;
  angle: number;
  confidence: number;
}

export interface MapData {
  name: string;
}

export interface SpeedData {
  is_stop: boolean;
  vx: number;
  vy: number;
  w: number;
  r_vx: number;
  r_vy: number;
  r_w: number;
  ret_code: number;
  create_on: string;
  err_msg: string;
}

export type ConnectionState = "connecting" | "connected" | "closed" | "error";

export interface RobotStatusLog {
  id: number;
  data: unknown;
}

interface RobotContextType {
  connected: ConnectionState;

  /** Whether Node-RED is currently registered with the gateway. */
  noderedOnline: boolean;

  flow: FlowNode[];

  battery: BatteryData | null;

  map: MapData | null;

  current_poi: CurrentPOI | null;

  speed: SpeedData | null;

  robotStatusLogs: RobotStatusLog[];

  rec_file: string[];

  socketUrl: string;

  setSocketUrl: (url: string) => void;

  send: (payload: unknown) => void;

  reconnect: () => void;
}

const RobotContext = createContext<RobotContextType | null>(null);

export function RobotProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);

  const [connected, setConnected] = useState<ConnectionState>("connecting");
  const [noderedOnline, setNoderedOnline] = useState(false);

  const [flow, setFlow] = useState<FlowNode[]>([]);

  const [battery, setBattery] = useState<BatteryData | null>(null);

  const [map, setMap] = useState<MapData | null>(null);

  const [current_poi, setCurrent_poi] = useState<CurrentPOI | null>(null);

  const [rec_file, setRec_file] = useState<string[]>([]);

  const [speed, setSpeed] = useState<SpeedData | null>(null);

  const [robotStatusLogs, setRobotStatusLogs] = useState<RobotStatusLog[]>([]);
  const robotStatusLogIdRef = useRef(0);

  const [socketUrl, setSocketUrl] = useState("");

  useEffect(() => {
    const savedSocketUrl = localStorage.getItem("robot_ws");

    if (savedSocketUrl) {
      setSocketUrl(savedSocketUrl);
    }
  }, []);

  const send = useCallback((payload: unknown) => {
    if (!wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) return;

    // Always use the browser_command envelope so the gateway can distinguish
    // commands from subscription messages.
    wsRef.current.send(
      JSON.stringify({ type: "browser_command", payload }),
    );
  }, []);

  const connect = useCallback(() => {
    if (!socketUrl) return;

    shouldReconnectRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    wsRef.current?.close();

    setConnected("connecting");

    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      setConnected("connected");

      localStorage.setItem("robot_ws", socketUrl);

      socket.send(
        JSON.stringify({
          subscribe: [
            "flow",
            "battery",
            "speed",
            "current_poi",
            "map",
            "rec_file",
            "robot_status",
          ],
        }),
      );
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Gateway system events
        if (msg.type === "nodered_status") {
          setNoderedOnline(Boolean(msg.online));
          return;
        }

        switch (msg.topic) {
          case "flow": {
            let data = msg.data;
            if (typeof data === "string") {
              try {
                data = JSON.parse(data);
              } catch {
                data = [];
              }
            }

            setFlow(Array.isArray(data) ? data : []);

            break;
          }

          case "battery":
            setBattery(msg.data);
            break;

          case "current_poi":
            setCurrent_poi(msg.data);
            break;

          case "map":
            setMap(msg.data);
            break;
          case "rec_file":
            setRec_file(msg.data);
            break;

          case "speed":
            setSpeed(msg.data);
            break;

          case "robot_status":
            robotStatusLogIdRef.current += 1;
            setRobotStatusLogs((previous) => [
              ...previous.slice(-49),
              {
                id: robotStatusLogIdRef.current,
                data: msg.data.message,
              },
            ]);
            break;

          default:
            break;
        }
      } catch {
        console.log(event.data);
      }
    };

    socket.onerror = () => {
      setConnected("error");
    };

    socket.onclose = () => {
      if (wsRef.current !== socket) return;

      setConnected("closed");

      if (shouldReconnectRef.current) {
        reconnectTimerRef.current = setTimeout(connect, 3000);
      }
    };

    wsRef.current = socket;
  }, [socketUrl]);

  useEffect(() => {
    shouldReconnectRef.current = true;

    if (socketUrl) connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, socketUrl]);

  const value = useMemo(
    () => ({
      connected,

      noderedOnline,

      flow,

      battery,

      current_poi,

      map,

      rec_file,

      speed,

      robotStatusLogs,

      socketUrl,

      setSocketUrl,

      send,

      reconnect: connect,
    }),
    [
      connected,
      noderedOnline,
      flow,
      battery,
      current_poi,
      socketUrl,
      send,
      connect,
      map,
      rec_file,
      robotStatusLogs,
    ],
  );

  return (
    <RobotContext.Provider value={value}>{children}</RobotContext.Provider>
  );
}

export function useRobot() {
  const ctx = useContext(RobotContext);

  if (!ctx) {
    throw new Error("useRobot must be used inside RobotProvider");
  }

  return ctx;
}
