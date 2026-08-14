export interface SwitchRule {
  t: string;
  v: string;
  vt: string;
}

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