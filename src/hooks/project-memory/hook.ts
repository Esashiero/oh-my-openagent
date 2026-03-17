/**
 * Project Memory Hook
 *
 * Orchestrates project stack detection, storage, and context injection
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { ContextCollector } from "../../features/context-injector";
import { detect } from "./detector.js";
import type { DetectionResult } from "./types.js";
import { loadMemory, saveMemory } from "./storage.js";
import type { ProjectMemoryData } from "./types.js";
import { formatForContext } from "./formatter.js";

// LRU cache for session-level detection (avoid re-detecting in same session)
const sessionCache = new Map<string, ProjectMemoryData>();
const MAX_SESSIONS = 100;

// Evict oldest entries when cache is full
function evictIfNeeded(): void {
  if (sessionCache.size >= MAX_SESSIONS) {
    const firstKey = sessionCache.keys().next().value;
    if (firstKey) {
      sessionCache.delete(firstKey);
    }
  }
}

export function createProjectMemoryHook(
  _ctx: PluginInput,
  collector?: ContextCollector
) {
  return {
    name: "projectMemory" as const,

    /**
     * On session.start:
     * 1. Check session cache (avoid re-detection)
     * 2. Detect project stack
     * 3. Load existing memory
     * 4. Merge detection with existing
     * 5. Save merged memory
     * 6. Format and inject context
     */
    "session.start": async (event: {
      sessionID: string;
      workingDirectory: string;
    }): Promise<void> => {
      const { sessionID, workingDirectory } = event;

      // Check session cache first
      if (sessionCache.has(sessionID)) {
        const cached = sessionCache.get(sessionID)!;
        if (cached.techStack.language || cached.frameworks.length > 0) {
          // Already detected for this session, inject cached context
          const context = formatForContext(cached);
          if (context.length > 0 && collector) {
            collector.register(sessionID, {
              id: "project-memory",
              source: "project-memory",
              content: context,
              priority: "normal",
            });
          }
        }
        return;
      }

      try {
        // Step 1: Detect project stack
        const detected: DetectionResult = await detect(workingDirectory);

        // Step 2: Load existing memory
        const existing = loadMemory(workingDirectory);

        // Step 3: Merge detected with existing (simple override for now)
        const merged: ProjectMemoryData = {
          ...existing,
          lastScanned: Date.now(),
          projectRoot: workingDirectory,
          techStack: detected.techStack || existing.techStack,
          frameworks: detected.frameworks.length > 0 ? detected.frameworks : existing.frameworks,
          buildCommands: detected.buildCommands.length > 0 ? detected.buildCommands : existing.buildCommands,
          testCommands: detected.testCommands.length > 0 ? detected.testCommands : existing.testCommands,
          mainDirectories: detected.mainDirectories.length > 0 ? detected.mainDirectories : existing.mainDirectories,
        };

        // Step 4: Save merged memory
        saveMemory(workingDirectory, merged);

        // Step 5: Add to session cache
        evictIfNeeded();
        sessionCache.set(sessionID, merged);

        // Step 6: Format and inject context
        const context = formatForContext(merged);
        if (context.length > 0 && collector) {
          collector.register(sessionID, {
            id: "project-memory",
            source: "project-memory",
            content: context,
            priority: "normal",
          });
        }
      } catch (error) {
        // Log warning but don't crash - detection is best-effort
        console.warn(
          `[project-memory] Detection failed for ${workingDirectory}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },

    /**
     * Clear session cache on session.end to free memory
     */
    "session.end": async (event: { sessionID: string }): Promise<void> => {
      sessionCache.delete(event.sessionID);
    },
  };
}
