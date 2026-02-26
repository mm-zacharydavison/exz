const ENTER_ALT_SCREEN = "\x1b[?1049h\x1b[2J\x1b[H";
// Leave alt screen, then clear + cursor home so Ink re-renders
// onto a clean slate (its differential renderer would otherwise
// try to update from a stale cursor position).
const LEAVE_ALT_SCREEN = "\x1b[?1049l\x1b[2J\x1b[H";

/**
 * Enter the terminal's alternate screen buffer.
 * Returns a cleanup function that restores the original screen.
 * The cleanup is idempotent — safe to call multiple times.
 */
export function enterFullscreen(): () => void {
  let restored = false;

  const restore = () => {
    if (restored) return;
    restored = true;
    process.stdout.write(LEAVE_ALT_SCREEN);
    process.removeListener("exit", restore);
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  };

  const onSignal = () => {
    restore();
    process.exit();
  };

  process.stdout.write(ENTER_ALT_SCREEN);
  process.on("exit", restore);
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  return restore;
}
