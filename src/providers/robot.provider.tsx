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

import { FlowNode } from "@/core/interface/flow";
import { BatteryData } from "@/core/interface/battery";
import { RobotStatusLog } from "@/core/interface/log";
import { CurrentPOI } from "@/core/interface/poi";
import { SpeedData } from "@/core/interface/speed";
import { connectionStates } from "@/core/types/status";

interface RobotContextType {
  connected: connectionStates;

  noderedOnline: boolean;

  flow: FlowNode[];

  battery: BatteryData | null;

  map: { name: string } | null;

  current_poi: CurrentPOI | null;

  speed: SpeedData | null;

  robotStatusLogs: RobotStatusLog[];

  rec_file: string[];

  socketUrl: string;

  setSocketUrl: (url: string) => void;

  send: (payload: object) => void;

  reconnect: () => void;

  connectionEpoch: number;
}

const RobotContext = createContext<RobotContextType | null>(null);

export function RobotProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // false = ยังไม่กด Connect
  // true = เคยกด Connect แล้ว สามารถ reconnect อัตโนมัติได้
  const shouldReconnectRef = useRef(false);

  const [connected, setConnected] = useState<connectionStates>("closed");

  const [noderedOnline, setNoderedOnline] = useState(false);

  const [flow, setFlow] = useState<FlowNode[]>([]);

  const [battery, setBattery] = useState<BatteryData | null>(null);

  const [map, setMap] = useState<{ name: string } | null>(null);

  const [current_poi, setCurrent_poi] = useState<CurrentPOI | null>(null);

  const [rec_file, setRec_file] = useState<string[]>([]);

  const [speed, setSpeed] = useState<SpeedData | null>(null);

  const [robotStatusLogs, setRobotStatusLogs] = useState<RobotStatusLog[]>([]);

  const robotStatusLogIdRef = useRef(0);

  const [socketUrl, setSocketUrl] = useState("");

  const [connectionEpoch, setConnectionEpoch] = useState(0);

  // โหลด URL ที่เคยบันทึกไว้
  // แต่จะยังไม่ connect
  useEffect(() => {
    const savedSocketUrl = localStorage.getItem("robot_ws");

    if (savedSocketUrl) {
      setSocketUrl(savedSocketUrl);
    }
  }, []);

  const send = useCallback((payload: object) => {
    if (!wsRef.current) return;

    if (wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify(payload));
  }, []);

  const connect = useCallback(() => {
    if (!socketUrl) {
      console.warn("WebSocket URL is empty");
      return;
    }

    // กด Connect แล้ว ถึงจะอนุญาตให้ reconnect
    shouldReconnectRef.current = true;

    // ล้าง reconnect timer เก่า
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // ถ้ามี socket เก่าอยู่ ให้ปิดก่อน
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected("connecting");

    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      setConnected("connected");

      setConnectionEpoch((prev) => prev + 1);
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
            setSpeed(msg.data?.speed ?? msg.data);
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
      wsRef.current = null;

      // reconnect เฉพาะกรณีที่ user เคยกด Connect
      if (shouldReconnectRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };

    wsRef.current = socket;
  }, [socketUrl]);

  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const savedSocketUrl = localStorage.getItem("robot_ws");

    if (savedSocketUrl) {
      setSocketUrl(savedSocketUrl);
    }
  }, []);

  useEffect(() => {
    if (!socketUrl) return;

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [socketUrl, connect]);

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

      // ปุ่ม Connect จะเรียก connect()
      reconnect: connect,

      connectionEpoch,
    }),
    [
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
      send,
      connect,
      connectionEpoch,
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
