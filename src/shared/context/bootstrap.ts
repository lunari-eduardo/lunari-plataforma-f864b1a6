/**
 * Bootstrap do Context Engine v1.
 * Chamado uma vez em `src/main.tsx` (após kernel/policy).
 */
import { registerContextProvider } from ".";
import { profileContextProvider } from "./providers/profile";
import { rolloutContextProvider } from "./providers/rollout";

let booted = false;
export function bootstrapContext(): void {
  if (booted) return;
  booted = true;
  registerContextProvider(profileContextProvider);
  registerContextProvider(rolloutContextProvider);
}
