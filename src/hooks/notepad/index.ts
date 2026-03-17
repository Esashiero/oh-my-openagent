/**
 * Notepad Core Logic
 *
 * Provides compaction-resilient memory persistence using notepad.md format.
 * Three-tier memory system:
 * 1. Priority Context - Always loaded, critical discoveries
 * 2. Working Memory - Session notes, auto-pruned after N days
 * 3. MANUAL - User content, never auto-pruned
 *
 * Uses file locking for concurrent access safety.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { withFileLockSync, lockPathFor } from "../../shared/file-lock";
import { log } from "../../shared/logger";
import {
  NOTEPAD_FILENAME,
  STATE_DIR_NAME,
  SECTION_HEADERS,
  DEFAULT_NOTEPAD_CONFIG,
} from "./constants";
import type { NotepadStats, PriorityContextResult, PruneResult } from "./types";

// ============================================================================
// File Path Utilities
// ============================================================================

/**
 * Get the path to notepad.md in .sisyphus subdirectory
 */
export function getNotepadPath(workingDirectory: string): string {
  return join(workingDirectory, STATE_DIR_NAME, NOTEPAD_FILENAME);
}

/**
 * Ensure .sisyphus directory exists
 */
export function ensureNotepadDir(workingDirectory: string): void {
  const dirPath = join(workingDirectory, STATE_DIR_NAME);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================================================
// Notepad Initialization
// ============================================================================

/**
 * Initialize notepad.md with section headers if missing
 */
export function initNotepad(workingDirectory: string): void {
  ensureNotepadDir(workingDirectory);

  const notepadPath = getNotepadPath(workingDirectory);
  if (existsSync(notepadPath)) {
    return; // Already exists
  }

  const content = `# Notepad
<!-- Auto-managed by Sisyphus. Manual edits preserved in MANUAL section. -->

${SECTION_HEADERS.priority}
<!-- ALWAYS loaded. Keep under ${DEFAULT_NOTEPAD_CONFIG.priorityMaxChars} chars. Critical discoveries only. -->

${SECTION_HEADERS.working}
<!-- Session notes. Auto-pruned after ${DEFAULT_NOTEPAD_CONFIG.workingMemoryDays} days. -->

${SECTION_HEADERS.manual}
<!-- User content. Never auto-pruned. -->

`;

  try {
    writeFileSync(notepadPath, content, "utf-8");
  } catch (err) {
    log("warn", `Failed to initialize notepad: ${err}`);
  }
}

/**
 * Read entire notepad content (internal)
 */
function readNotepadContent(workingDirectory: string): string | null {
  const notepadPath = getNotepadPath(workingDirectory);
  if (!existsSync(notepadPath)) {
    return null;
  }

  try {
    return readFileSync(notepadPath, "utf-8");
  } catch (err) {
    log("warn", `Failed to read notepad: ${err}`);
    return null;
  }
}

// ============================================================================
// Section Extraction
// ============================================================================

/**
 * Extract content between a section header and the next ## header
 */
export function extractSection(content: string, header: string): string {
  // Match from header to next section (## followed by space, at start of line)
  const regex = new RegExp(`${header}\\n([\\s\\S]*?)(?=\\n## [^#]|$)`);
  const match = content.match(regex);
  if (!match) {
    return "";
  }

  // Clean up: remove HTML comments and trim
  let section = match[1];
  section = section.replace(/<!--[\s\S]*?-->/g, "").trim();

  return section;
}

/**
 * Replace a section in notepad content
 */
function replaceSection(
  content: string,
  header: string,
  newContent: string,
): string {
  const regex = new RegExp(`(${header}\\n)([\\s\\S]*?)(?=## |$)`);

  // Preserve comment if it exists
  const commentMatch = content.match(
    new RegExp(`${header}\\n(<!--[\\s\\S]*?-->)`),
  );
  const comment = commentMatch ? commentMatch[1] + "\n" : "";

  return content.replace(regex, `$1${comment}${newContent}\n\n`);
}

// ============================================================================
// Section Getters
// ============================================================================

/**
 * Get Priority Context section
 */
export function getPriorityContext(
  workingDirectory: string,
): PriorityContextResult {
  const content = readNotepadContent(workingDirectory);
  if (!content) {
    return { content: "", size: 0 };
  }

  const sectionContent = extractSection(content, SECTION_HEADERS.priority);
  return {
    content: sectionContent,
    size: sectionContent.length,
  };
}

/**
 * Format priority context for injection into prompts
 * Wraps content in XML tags for clear demarcation
 */
export function formatNotepadContext(content: string): string {
  if (!content || content.trim().length === 0) {
    return "";
  }
  return `<notepad-priority>\n${content}\n</notepad-priority>`;
}

/**
 * Get Working Memory section
 */
export function getWorkingMemory(workingDirectory: string): string {
  const content = readNotepadContent(workingDirectory);
  if (!content) {
    return "";
  }

  return extractSection(content, SECTION_HEADERS.working);
}

/**
 * Get MANUAL section
 */
export function getManualSection(workingDirectory: string): string {
  const content = readNotepadContent(workingDirectory);
  if (!content) {
    return "";
  }

  return extractSection(content, SECTION_HEADERS.manual);
}

/**
 * Get full notepad content
 */
export function getFullNotepad(workingDirectory: string): string {
  return readNotepadContent(workingDirectory) ?? "";
}

// ============================================================================
// Section Setters
// ============================================================================

/**
 * Set Priority Context section (replaces content)
 */
export function setPriorityContext(
  workingDirectory: string,
  content: string,
): PriorityContextResult {
  // Initialize if needed
  const notepadPath = getNotepadPath(workingDirectory);
  if (!existsSync(notepadPath)) {
    initNotepad(workingDirectory);
  }

  try {
    return withFileLockSync(lockPathFor(notepadPath), () => {
      let notepadContent = readFileSync(notepadPath, "utf-8");

      // Check size and warn if over limit
      const warning =
        content.length > DEFAULT_NOTEPAD_CONFIG.priorityMaxChars
          ? `Priority Context exceeds ${DEFAULT_NOTEPAD_CONFIG.priorityMaxChars} chars (${content.length} chars). Consider condensing.`
          : undefined;

      // Replace the section
      notepadContent = replaceSection(
        notepadContent,
        SECTION_HEADERS.priority,
        content,
      );

      writeFileSync(notepadPath, notepadContent, "utf-8");

      return { content, size: content.length, warning };
    }, { timeoutMs: 5000 });
  } catch (err) {
    log("warn", `Failed to set priority context: ${err}`);
    return { content: "", size: 0 };
  }
}

/**
 * Add entry to Working Memory with timestamp
 */
export function addWorkingMemoryEntry(
  workingDirectory: string,
  content: string,
): boolean {
  // Initialize if needed
  const notepadPath = getNotepadPath(workingDirectory);
  if (!existsSync(notepadPath)) {
    initNotepad(workingDirectory);
  }

  try {
    return withFileLockSync(lockPathFor(notepadPath), () => {
      let notepadContent = readFileSync(notepadPath, "utf-8");

      // Get current Working Memory content
      const currentMemory = extractSection(
        notepadContent,
        SECTION_HEADERS.working,
      );

      // Format timestamp: YYYY-MM-DD HH:MM
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 16).replace("T", " ");

      // Add new entry
      const newEntry = `### ${timestamp}\n${content}\n`;
      const updatedMemory = currentMemory
        ? currentMemory + "\n" + newEntry
        : newEntry;

      // Replace the section
      notepadContent = replaceSection(
        notepadContent,
        SECTION_HEADERS.working,
        updatedMemory,
      );

      writeFileSync(notepadPath, notepadContent, "utf-8");
      return true;
    }, { timeoutMs: 5000 });
  } catch (err) {
    log("warn", `Failed to add working memory entry: ${err}`);
    return false;
  }
}

/**
 * Add entry to MANUAL section with timestamp
 */
export function addManualEntry(
  workingDirectory: string,
  content: string,
): boolean {
  // Initialize if needed
  const notepadPath = getNotepadPath(workingDirectory);
  if (!existsSync(notepadPath)) {
    initNotepad(workingDirectory);
  }

  try {
    return withFileLockSync(lockPathFor(notepadPath), () => {
      let notepadContent = readFileSync(notepadPath, "utf-8");

      // Get current MANUAL content
      const currentManual = extractSection(
        notepadContent,
        SECTION_HEADERS.manual,
      );

      // Format timestamp
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 16).replace("T", " ");

      // Add new entry with timestamp
      const newEntry = `### ${timestamp}\n${content}\n`;
      const updatedManual = currentManual
        ? currentManual + "\n" + newEntry
        : newEntry;

      // Replace the section
      notepadContent = replaceSection(
        notepadContent,
        SECTION_HEADERS.manual,
        updatedManual,
      );

      writeFileSync(notepadPath, notepadContent, "utf-8");
      return true;
    }, { timeoutMs: 5000 });
  } catch (err) {
    log("warn", `Failed to add manual entry: ${err}`);
    return false;
  }
}

// ============================================================================
// Pruning
// ============================================================================

/**
 * Prune Working Memory entries older than N days
 */
export function pruneWorkingMemory(
  workingDirectory: string,
  daysOld: number = DEFAULT_NOTEPAD_CONFIG.workingMemoryDays,
): PruneResult {
  const notepadPath = getNotepadPath(workingDirectory);
  if (!existsSync(notepadPath)) {
    return { pruned: 0, remaining: 0 };
  }

  try {
    return withFileLockSync(lockPathFor(notepadPath), () => {
      let notepadContent = readFileSync(notepadPath, "utf-8");
      const workingMemory = extractSection(
        notepadContent,
        SECTION_HEADERS.working,
      );

      if (!workingMemory) {
        return { pruned: 0, remaining: 0 };
      }

      // Parse entries: ### YYYY-MM-DD HH:MM
      const entryRegex =
        /### (\d{4}-\d{2}-\d{2} \d{2}:\d{2})\n([\s\S]*?)(?=### |$)/g;
      const entries: Array<{ timestamp: string; content: string }> = [];
      let match: RegExpExecArray | null = entryRegex.exec(workingMemory);

      while (match !== null) {
        entries.push({
          timestamp: match[1],
          content: match[2].trim(),
        });
        match = entryRegex.exec(workingMemory);
      }

      // Calculate cutoff date
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysOld);

      // Filter entries - keep those newer than cutoff
      const kept = entries.filter((entry) => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= cutoff;
      });

      const pruned = entries.length - kept.length;

      // Rebuild Working Memory section
      const newContent = kept
        .map((entry) => `### ${entry.timestamp}\n${entry.content}`)
        .join("\n\n");

      notepadContent = replaceSection(
        notepadContent,
        SECTION_HEADERS.working,
        newContent,
      );

      writeFileSync(notepadPath, notepadContent, "utf-8");
      return { pruned, remaining: kept.length };
    }, { timeoutMs: 5000 });
  } catch (err) {
    log("warn", `Failed to prune working memory: ${err}`);
    return { pruned: 0, remaining: 0 };
  }
}

// ============================================================================
// Stats
// ============================================================================

/**
 * Get notepad statistics
 */
export function getNotepadStats(workingDirectory: string): NotepadStats {
  const notepadPath = getNotepadPath(workingDirectory);

  if (!existsSync(notepadPath)) {
    return {
      totalSize: 0,
      prioritySize: 0,
      workingMemorySize: 0,
      manualSize: 0,
      workingMemoryEntries: 0,
      manualEntries: 0,
      oldestEntry: null,
    };
  }

  const content = readFileSync(notepadPath, "utf-8");
  const priority = extractSection(content, SECTION_HEADERS.priority);
  const workingMemory = extractSection(content, SECTION_HEADERS.working);
  const manual = extractSection(content, SECTION_HEADERS.manual);

  // Count entries - support ### YYYY-MM-DD HH:MM format
  const workingMemoryMatches = workingMemory.match(
    /### \d{4}-\d{2}-\d{2} \d{2}:\d{2}/g,
  );
  const manualMatches = manual.match(/### \d{4}-\d{2}-\d{2} \d{2}:\d{2}/g);

  const workingMemoryCount = workingMemoryMatches?.length ?? 0;
  const manualCount = manualMatches?.length ?? 0;

  // Find oldest entry
  let oldestEntry: string | null = null;
  const allMatches = workingMemoryMatches ?? [];
  if (allMatches.length > 0) {
    const timestamps = allMatches.map((m) => m.replace("### ", ""));
    timestamps.sort();
    oldestEntry = timestamps[0];
  }

  return {
    totalSize: Buffer.byteLength(content, "utf-8"),
    prioritySize: Buffer.byteLength(priority, "utf-8"),
    workingMemorySize: Buffer.byteLength(workingMemory, "utf-8"),
    manualSize: Buffer.byteLength(manual, "utf-8"),
    workingMemoryEntries: workingMemoryCount,
    manualEntries: manualCount,
    oldestEntry,
  };
}

// ============================================================================
// Utility: Reinitialize Corrupted Notepad
// ============================================================================

/**
 * Attempt to recover from corrupted notepad by reinitializing
 */
export function recoverNotepad(workingDirectory: string): void {
  const notepadPath = getNotepadPath(workingDirectory);
  log("warn", `Attempting to recover corrupted notepad at ${notepadPath}`);

  try {
    // Read current content to preserve MANUAL section if possible
    let manualSection = "";
    try {
      const currentContent = readFileSync(notepadPath, "utf-8");
      manualSection = extractSection(currentContent, SECTION_HEADERS.manual);
    } catch {
      // If we can't read it, start fresh
    }

    // Reinitialize
    initNotepad(workingDirectory);

    // Restore MANUAL section if we have it
    if (manualSection) {
      const newContent = readFileSync(notepadPath, "utf-8");
      const restored = replaceSection(
        newContent,
        SECTION_HEADERS.manual,
        manualSection,
      );
      writeFileSync(notepadPath, restored, "utf-8");
    }
  } catch (err) {
    log("error", `Failed to recover notepad: ${err}`);
  }
}
