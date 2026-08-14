import type { FlowNode } from "../core/interface/flow";
import { QueueStep } from "@/core/interface/queue"

export function traceChain(
  startNode: FlowNode,
  nodeMap: Map<string, FlowNode>,
): Omit<QueueStep, "key" | "label" | "jobId" | "isJobStart">[] {
  const steps = [];
  const visited = new Set<string>();

  let current: FlowNode | undefined = startNode;

  while (current?.type && ChaniableTypes.has(current.type)) {
    if (!current.id || visited.has(current.id)) break;

    visited.add(current.id);

    steps.push({
      id: current.id,
      poi: (current.poi as string) ?? "",
      type: current.type,
      operation: current.operation as string | undefined,
    });

    current = current.wires?.[0]?.[0]
      ? nodeMap.get(current.wires[0][0])
      : undefined;
  }

  return steps;
}

const ChaniableTypes = new Set([
  "next-robot-movement",
  "next-robot-jack",
]);

interface WebsocketGroup {
  websocket: string;
  sections: Array<{
    name: string;
    buttons: ButtonAction[];
  }>;
}

interface ButtonAction {
  text: string;
  target: FlowNode;
}

/** Extract buttons from a switch node's rules */
function switchToButtons(
  switchNode: FlowNode,
  nodeMap: Map<string, FlowNode>,
): ButtonAction[] {
  return (switchNode.rules ?? [])
    .map((rule, index): ButtonAction | null => {
      const target = switchNode.wires?.[index]?.[0]
        ? nodeMap.get(switchNode.wires[index][0])
        : undefined;

      return target && rule.v ? { text: rule.v, target } : null;
    })
    .filter((button): button is ButtonAction => button !== null);
}

export function buildWebsocketGroups(
  tabNodes: FlowNode[],
  nodeMap: Map<string, FlowNode>,
): WebsocketGroup[] {
  return tabNodes
    .filter((node) => node.type === "websocket in" && node.name === "Robot task")
    .map((websocket) => {
      const directChildren = (websocket.wires?.flat() ?? [])
        .map((id) => nodeMap.get(id))
        .filter((node): node is FlowNode => !!node);

      const sections: WebsocketGroup["sections"] = [];

      for (const child of directChildren) {
        if (child.type === "switch") {
          // ── websocket in → switch (flat, no group) ────────────────────
          sections.push({
            name: child.name || "Switch",
            buttons: switchToButtons(child, nodeMap),
          });
        } else if (child.type === "json") {
          // ── websocket in → json → switch ──────────────────────────────
          // json acts as section header; its downstream switches hold the buttons
          const nestedSwitches = (child.wires?.flat() ?? [])
            .map((id) => nodeMap.get(id))
            .filter((node): node is FlowNode => node?.type === "switch");

          if (nestedSwitches.length > 0) {
            // Use json node name if meaningful, else fall back to first switch name
            const sectionName =
              child.name && child.name.toLowerCase() !== "json"
                ? child.name
                : nestedSwitches[0].name || "Section";

            sections.push({
              name: sectionName,
              buttons: nestedSwitches.flatMap((sw) =>
                switchToButtons(sw, nodeMap),
              ),
            });
          }
        }
      }

      return {
        websocket: websocket.name || "Websocket",
        sections,
      };
    });
}