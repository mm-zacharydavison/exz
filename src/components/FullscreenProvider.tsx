import { useLayoutEffect } from "react";
import { enterFullscreen } from "../core/fullscreen.ts";

interface FullscreenProviderProps {
  enabled: boolean;
  children: React.ReactNode;
}

export function FullscreenProvider({
  enabled,
  children,
}: FullscreenProviderProps) {
  // useLayoutEffect so the cleanup (leave alt screen) fires synchronously
  // before Ink flushes the next render. useEffect cleanup would run after
  // Ink writes, sending the menu to the alt screen and then leaving it.
  useLayoutEffect(() => {
    if (!enabled) return;
    const cleanup = enterFullscreen();
    return cleanup;
  }, [enabled]);

  return <>{children}</>;
}
