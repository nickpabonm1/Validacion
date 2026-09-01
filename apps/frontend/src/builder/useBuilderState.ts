import { useCallback, useReducer } from "react";
import type { HeaderItem, ThemeVariable } from "@fad-console/validation-schemas";
import { emptyBuilderConfig, defaultStepEntryFor } from "./defaults";
import type { BuilderConfig, BuilderStepEntry } from "./types";

type Action =
  | { type: "LOAD_CONFIG"; config: BuilderConfig }
  | { type: "SET_META"; processName?: string; validity?: number }
  | { type: "SET_CLIENT"; client: Partial<BuilderConfig["client"]> }
  | { type: "SET_REDIRECT_URL"; url: string }
  | { type: "SET_NOTIFICATIONS"; notifications: Partial<BuilderConfig["notifications"]> }
  | { type: "ADD_STEP"; stepKey: string }
  | { type: "REMOVE_STEP"; stepKey: string }
  | { type: "TOGGLE_SHOW"; stepKey: string }
  | { type: "REORDER_STEPS"; orderedKeys: string[] }
  | { type: "UPDATE_STEP"; stepKey: string; patch: Partial<BuilderStepEntry> }
  | { type: "RESET_STEP"; stepKey: string }
  | { type: "SET_THEME"; theme: ThemeVariable[] }
  | { type: "SET_HEADER"; header: HeaderItem[] }
  | { type: "RESET_THEME" };

function sortedStepKeys(steps: BuilderConfig["steps"]): string[] {
  return Object.entries(steps)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key]) => key);
}

function renumber(steps: BuilderConfig["steps"], orderedKeys: string[]): BuilderConfig["steps"] {
  const next: BuilderConfig["steps"] = {};
  orderedKeys.forEach((key, index) => {
    const existing = steps[key];
    if (existing) next[key] = { ...existing, order: index + 1 };
  });
  return next;
}

function reducer(state: BuilderConfig, action: Action): BuilderConfig {
  switch (action.type) {
    case "LOAD_CONFIG":
      return action.config;
    case "SET_META":
      return {
        ...state,
        processName: action.processName ?? state.processName,
        validity: action.validity ?? state.validity,
      };
    case "SET_CLIENT":
      return { ...state, client: { ...state.client, ...action.client } };
    case "SET_REDIRECT_URL":
      return { ...state, feature: action.url ? { redirect: { url: action.url } } : {} };
    case "SET_NOTIFICATIONS":
      return { ...state, notifications: { ...state.notifications, ...action.notifications } };
    case "ADD_STEP": {
      if (state.steps[action.stepKey]) return state;
      const nextOrder = Object.keys(state.steps).length + 1;
      return {
        ...state,
        steps: { ...state.steps, [action.stepKey]: defaultStepEntryFor(action.stepKey, nextOrder) },
      };
    }
    case "REMOVE_STEP": {
      const remainingKeys = sortedStepKeys(state.steps).filter((key) => key !== action.stepKey);
      const remaining = { ...state.steps };
      delete remaining[action.stepKey];
      return { ...state, steps: renumber(remaining, remainingKeys) };
    }
    case "TOGGLE_SHOW": {
      const step = state.steps[action.stepKey];
      if (!step) return state;
      return { ...state, steps: { ...state.steps, [action.stepKey]: { ...step, show: !step.show } } };
    }
    case "REORDER_STEPS":
      return { ...state, steps: renumber(state.steps, action.orderedKeys) };
    case "UPDATE_STEP": {
      const step = state.steps[action.stepKey];
      if (!step) return state;
      return { ...state, steps: { ...state.steps, [action.stepKey]: { ...step, ...action.patch } } };
    }
    case "RESET_STEP": {
      const step = state.steps[action.stepKey];
      if (!step) return state;
      return { ...state, steps: { ...state.steps, [action.stepKey]: defaultStepEntryFor(action.stepKey, step.order) } };
    }
    case "SET_THEME":
      return { ...state, customization: { ...state.customization, theme: action.theme } };
    case "SET_HEADER":
      return { ...state, customization: { ...state.customization, header: action.header } };
    case "RESET_THEME":
      return { ...state, customization: { theme: [], header: [] } };
    default:
      return state;
  }
}

export function useBuilderState(initial?: BuilderConfig) {
  const [config, dispatch] = useReducer(reducer, initial ?? emptyBuilderConfig());

  return {
    config,
    orderedStepKeys: sortedStepKeys(config.steps),
    loadConfig: useCallback((c: BuilderConfig) => dispatch({ type: "LOAD_CONFIG", config: c }), []),
    setMeta: useCallback((v: { processName?: string; validity?: number }) => dispatch({ type: "SET_META", ...v }), []),
    setClient: useCallback((client: Partial<BuilderConfig["client"]>) => dispatch({ type: "SET_CLIENT", client }), []),
    setRedirectUrl: useCallback((url: string) => dispatch({ type: "SET_REDIRECT_URL", url }), []),
    setNotifications: useCallback(
      (notifications: Partial<BuilderConfig["notifications"]>) => dispatch({ type: "SET_NOTIFICATIONS", notifications }),
      [],
    ),
    addStep: useCallback((stepKey: string) => dispatch({ type: "ADD_STEP", stepKey }), []),
    removeStep: useCallback((stepKey: string) => dispatch({ type: "REMOVE_STEP", stepKey }), []),
    toggleShow: useCallback((stepKey: string) => dispatch({ type: "TOGGLE_SHOW", stepKey }), []),
    reorderSteps: useCallback((orderedKeys: string[]) => dispatch({ type: "REORDER_STEPS", orderedKeys }), []),
    updateStep: useCallback(
      (stepKey: string, patch: Partial<BuilderStepEntry>) => dispatch({ type: "UPDATE_STEP", stepKey, patch }),
      [],
    ),
    resetStep: useCallback((stepKey: string) => dispatch({ type: "RESET_STEP", stepKey }), []),
    setTheme: useCallback((theme: ThemeVariable[]) => dispatch({ type: "SET_THEME", theme }), []),
    setHeader: useCallback((header: HeaderItem[]) => dispatch({ type: "SET_HEADER", header }), []),
    resetTheme: useCallback(() => dispatch({ type: "RESET_THEME" }), []),
  };
}

export type BuilderStateApi = ReturnType<typeof useBuilderState>;
