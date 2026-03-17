/**
 * Project Memory Detector
 *
 * Detects tech stack, frameworks, build commands, test commands, and main directories
 */

import fs from "fs/promises";
import path from "path";
import {
  TechStackInfo,
  FrameworkInfo,
  DetectionResult,
} from "./types.js";
import {
  CONFIG_PATTERNS,
  FRAMEWORK_PATTERNS,
  MAIN_DIRECTORIES,
  BUILD_COMMAND_PATTERNS,
  TEST_COMMAND_PATTERNS,
} from "./constants.js";

/**
 * Detect tech stack: language, package manager, runtime
 */
export async function detectTechStack(projectRoot: string): Promise<TechStackInfo> {
  const result: TechStackInfo = {
    language: null,
    packageManager: null,
    runtime: null,
  };

  try {
    const packageManagerHints: string[] = [];

    for (const pattern of CONFIG_PATTERNS) {
      // Check if file exists using stat
      let exists = false;
      try {
        // Handle glob patterns like *.csproj
        if (pattern.file.includes("*")) {
          const dir = await fs.readdir(projectRoot);
          const globPattern = pattern.file.replace("*", "(.+)");
          const regex = new RegExp(`^${globPattern}$`);
          exists = dir.some((f) => regex.test(f));
        } else {
          const filePath = path.join(projectRoot, pattern.file);
          await fs.stat(filePath);
          exists = true;
        }
      } catch {
        exists = false;
      }

      if (exists) {
        // Detect language
        if (pattern.indicates.language && !result.language) {
          result.language = pattern.indicates.language;
        }

        // Collect package manager hints
        if (pattern.indicates.packageManager) {
          packageManagerHints.push(pattern.indicates.packageManager);
        }
      }
    }

    // Prioritize lockfile-based package managers
    const lockfileManagers = [
      "pnpm",
      "yarn",
      "bun",
      "cargo",
      "poetry",
      "pipenv",
      "bundler",
      "composer",
      "go",
    ];
    const lockfileMatch = packageManagerHints.find((pm) =>
      lockfileManagers.includes(pm)
    );
    result.packageManager = lockfileMatch || packageManagerHints[0] || null;

    // Detect runtime from package.json
    const packageJsonPath = path.join(projectRoot, "package.json");
    try {
      const content = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      if (packageJson.engines?.node) {
        result.runtime = `Node.js ${packageJson.engines.node.replace(/[\^~><= ]/g, "")}`;
      }

      // Check if using bun explicitly
      if (
        packageJson.engines?.bun ||
        (await fileExists(path.join(projectRoot, "bun.lockb"))) ||
        (await fileExists(path.join(projectRoot, "bun.lock")))
      ) {
        result.runtime = "bun";
      }
    } catch {
      // Ignore JSON parse errors
    }
  } catch {
    // Return default values on any error
  }

  return result;
}

/**
 * Detect frameworks from package.json dependencies
 */
export async function detectFrameworks(
  projectRoot: string
): Promise<FrameworkInfo[]> {
  const frameworks: FrameworkInfo[] = [];

  try {
    const packageJsonPath = path.join(projectRoot, "package.json");
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const name of Object.keys(deps)) {
      if (FRAMEWORK_PATTERNS[name]) {
        frameworks.push({
          name,
          category: FRAMEWORK_PATTERNS[name].category,
        });
      }
    }
  } catch {
    // Return empty array on error
  }

  return frameworks;
}

/**
 * Detect build commands from package.json scripts
 */
export async function detectBuildCommands(
  projectRoot: string
): Promise<string[]> {
  const buildCommands: string[] = [];

  try {
    const packageJsonPath = path.join(projectRoot, "package.json");
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    const scripts = packageJson.scripts || {};

    // Check all script names and values against patterns
    for (const [name, value] of Object.entries(scripts)) {
      const scriptString = `${name}: ${value}`;

      for (const pattern of BUILD_COMMAND_PATTERNS) {
        if (pattern.test(scriptString)) {
          if (!buildCommands.includes(name)) {
            buildCommands.push(name);
          }
        }
      }
    }
  } catch {
    // Return empty array on error
  }

  return buildCommands;
}

/**
 * Detect test commands from package.json scripts
 */
export async function detectTestCommands(
  projectRoot: string
): Promise<string[]> {
  const testCommands: string[] = [];

  try {
    const packageJsonPath = path.join(projectRoot, "package.json");
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    const scripts = packageJson.scripts || {};

    // Check all script names and values against patterns
    for (const [name, value] of Object.entries(scripts)) {
      const scriptString = `${name}: ${value}`;

      for (const pattern of TEST_COMMAND_PATTERNS) {
        if (pattern.test(scriptString)) {
          if (!testCommands.includes(name)) {
            testCommands.push(name);
          }
        }
      }
    }
  } catch {
    // Return empty array on error
  }

  return testCommands;
}

/**
 * Detect main directories in project root
 */
export async function detectMainDirectories(
  projectRoot: string
): Promise<string[]> {
  const directories: string[] = [];

  try {
    const entries = await fs.readdir(projectRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        MAIN_DIRECTORIES.includes(entry.name) &&
        !directories.includes(entry.name)
      ) {
        directories.push(entry.name);
      }
    }
  } catch {
    // Return empty array on error
  }

  return directories;
}

/**
 * Main detection function - combines all detection results
 */
export async function detect(projectRoot: string): Promise<DetectionResult> {
  const [techStack, frameworks, buildCommands, testCommands, mainDirectories] =
    await Promise.all([
      Promise.resolve(detectTechStack(projectRoot)),
      detectFrameworks(projectRoot),
      detectBuildCommands(projectRoot),
      detectTestCommands(projectRoot),
      detectMainDirectories(projectRoot),
    ]);

  return {
    techStack,
    frameworks,
    buildCommands,
    testCommands,
    mainDirectories,
  };
}

/**
 * Helper: Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
