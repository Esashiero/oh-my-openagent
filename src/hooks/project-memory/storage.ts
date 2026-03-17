/**
 * Project Memory Storage
 *
 * Handles loading and saving project memory to the filesystem.
 * Uses file locking for safe concurrent access.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import * as path from "path";
import { DEFAULT_PROJECT_MEMORY } from "./types.js";
import type { ProjectMemoryData, ProjectNote, ProjectDirective } from "./types.js";
import {
  acquireFileLockSync,
  releaseFileLockSync,
  lockPathFor,
} from "../../shared/file-lock/index.js";
import { MEMORY_FILE, STATE_DIR_NAME } from "./constants.js";

/**
 * Get the path to the project memory file
 */
export function getMemoryPath(projectRoot: string): string {
  return path.join(projectRoot, STATE_DIR_NAME, MEMORY_FILE);
}

/**
 * Load project memory from disk
 * Returns default memory if file doesn't exist or is invalid
 */
export function loadMemory(projectRoot: string): ProjectMemoryData {
  const memoryPath = getMemoryPath(projectRoot);

  try {
    const content = readFileSync(memoryPath, "utf-8");
    const memory = JSON.parse(content) as ProjectMemoryData;

    // Basic validation
    if (!memory.version || !memory.projectRoot) {
      return { ...DEFAULT_PROJECT_MEMORY, projectRoot };
    }

    return memory;
  } catch {
    // File doesn't exist or invalid JSON - return defaults
    return { ...DEFAULT_PROJECT_MEMORY, projectRoot };
  }
}

/**
 * Save project memory to disk
 * Creates .sisyphus directory if it doesn't exist
 */
export function saveMemory(projectRoot: string, data: ProjectMemoryData): void {
  const memoryPath = getMemoryPath(projectRoot);
  const sisyphusDir = path.dirname(memoryPath);

  try {
    // Ensure .sisyphus directory exists
    mkdirSync(sisyphusDir, { recursive: true });

    // Write memory file
    writeFileSync(memoryPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    // Silently fail - we don't want to break the session
    console.error("Failed to save project memory:", error);
  }
}

/**
 * Update memory with file locking for safe concurrent access
 * Loads existing memory, merges updates, and saves
 */
export function updateMemory(
  projectRoot: string,
  updates: Partial<ProjectMemoryData>,
): void {
  const memoryPath = getMemoryPath(projectRoot);
  const lockPath = lockPathFor(memoryPath);

  // Use synchronous lock for safety
  const handle = acquireFileLockSync(lockPath, { timeoutMs: 5000 });

  if (!handle) {
    // Could not acquire lock - fall back to save without locking
    const existing = loadMemory(projectRoot);
    const merged = { ...existing, ...updates };
    saveMemory(projectRoot, merged);
    return;
  }

  try {
    const existing = loadMemory(projectRoot);
    const merged = { ...existing, ...updates };
    saveMemory(projectRoot, merged);
  } finally {
    releaseFileLockSync(handle);
  }
}

/**
 * Add a new note to the project memory
 */
export function addNote(
  projectRoot: string,
  category: string,
  content: string,
): void {
  const note: ProjectNote = {
    category,
    content,
    timestamp: new Date().toISOString(),
  };

  updateMemory(projectRoot, {
    notes: [...loadMemory(projectRoot).notes, note],
  });
}

/**
 * Add a new directive to the project memory
 */
export function addDirective(
  projectRoot: string,
  directive: string,
  priority: "high" | "normal",
  context?: string,
): void {
  const newDirective: ProjectDirective = {
    directive,
    priority,
    context,
  };

  updateMemory(projectRoot, {
    directives: [...loadMemory(projectRoot).directives, newDirective],
  });
}
