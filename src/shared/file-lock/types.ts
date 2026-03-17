/**
 * Types for cross-process advisory file locking.
 */

import type { BunFile } from "bun";

/** Handle returned by lock acquisition; pass to release. */
export interface FileLockHandle {
  fd: number;
  path: string;
}

/** Options for lock acquisition. */
export interface FileLockOptions {
  /** Maximum time (ms) to wait for lock acquisition. 0 = single attempt. Default: 0 */
  timeoutMs?: number;
  /** Delay (ms) between retry attempts. Default: 50 */
  retryDelayMs?: number;
  /** Age (ms) after which a lock held by a dead PID is considered stale. Default: 30000 */
  staleLockMs?: number;
}

/** Payload stored in lock file. */
export interface LockPayload {
  pid: number;
  timestamp: number;
}
