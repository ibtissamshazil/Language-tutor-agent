import { useSyncExternalStore } from "react";
import {
  getPreferredModel,
  setPreferredModel,
  subscribeToPreferredModel,
} from "@/lib/model-preference";

/**
 * The chosen model, shared by the chat bar and the Settings page.
 *
 * Both surfaces subscribe to the same store, so changing the model in one
 * updates the other immediately instead of leaving a stale label behind.
 */
export function useModelPreference(): [string, (model: string) => void] {
  const model = useSyncExternalStore(
    subscribeToPreferredModel,
    getPreferredModel,
    getPreferredModel,
  );
  return [model, setPreferredModel];
}
