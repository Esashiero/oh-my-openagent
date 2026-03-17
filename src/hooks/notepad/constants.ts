/**
 * Notepad Constants
 *
 * Default configuration and section headers for notepad functionality.
 */

export const NOTEPAD_FILENAME = "notepad.md";

export const STATE_DIR_NAME = ".sisyphus";

export const DEFAULT_NOTEPAD_CONFIG = {
  priorityMaxChars: 500,
  workingMemoryDays: 7,
  maxTotalSize: 8192,
} as const;

export const SECTION_HEADERS = {
  priority: "## Priority Context",
  working: "## Working Memory",
  manual: "## MANUAL",
} as const;
