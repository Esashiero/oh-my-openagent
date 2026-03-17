/**
 * Notepad Types
 *
 * TypeScript interfaces for notepad functionality.
 */

export interface NotepadConfig {
  /** Maximum characters for Priority Context section */
  priorityMaxChars: number;
  /** Days to keep Working Memory entries before pruning */
  workingMemoryDays: number;
  /** Maximum total file size in bytes */
  maxTotalSize: number;
}

export type NotepadSection = "all" | "priority" | "working" | "manual";

export interface NotepadStats {
  /** Total file size in bytes */
  totalSize: number;
  /** Priority Context section size in bytes */
  prioritySize: number;
  /** Working Memory section size in bytes */
  workingMemorySize: number;
  /** MANUAL section size in bytes */
  manualSize: number;
  /** Number of Working Memory entries */
  workingMemoryEntries: number;
  /** Number of MANUAL entries */
  manualEntries: number;
  /** ISO timestamp of oldest entry */
  oldestEntry: string | null;
}

export interface PriorityContextResult {
  /** The content retrieved */
  content: string;
  /** Size of the content in characters */
  size: number;
}

export interface PruneResult {
  /** Number of entries pruned */
  pruned: number;
  /** Number of entries remaining */
  remaining: number;
}
