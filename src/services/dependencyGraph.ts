import { ProjectFile } from '../types';

export interface ModuleDependency {
  path: string;
  imports: {
    source: string;
    resolvedPath: string | null;
    specifiers: string[];
    isExternal: boolean;
  }[];
  exports: string[];
  dependents: string[]; // Files that import this file
  dependencies: string[]; // Files that this file imports
  likelyAffectedTests: string[];
}

export interface WorkspaceDependencyGraph {
  modules: Record<string, ModuleDependency>;
  circularDependencies: string[][];
  orphanedFiles: string[];
}

/**
 * Resolves relative and absolute internal project paths safely
 */
export function resolveInternalPath(fromPath: string, importSource: string, availablePaths: string[]): string | null {
  if (importSource.startsWith('.')) {
    // Relative resolution
    const fromDirParts = fromPath.split('/').slice(0, -1);
    const importParts = importSource.split('/');
    const resultParts = [...fromDirParts];

    for (const part of importParts) {
      if (part === '.') continue;
      if (part === '..') {
        resultParts.pop();
      } else {
        resultParts.push(part);
      }
    }

    const basePath = resultParts.join('/');
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
      `${basePath}.jsx`,
      `${basePath}.json`,
      `${basePath}/index.ts`,
      `${basePath}/index.tsx`,
      `${basePath}/index.js`,
    ];

    for (const c of candidates) {
      const match = availablePaths.find((p) => p === c);
      if (match) return match;
    }
  } else if (importSource.startsWith('src/')) {
    const candidates = [
      importSource,
      `${importSource}.ts`,
      `${importSource}.tsx`,
      `${importSource}.js`,
      `${importSource}.json`,
    ];
    for (const c of candidates) {
      const match = availablePaths.find((p) => p === c);
      if (match) return match;
    }
  }

  return null;
}

/**
 * Analyzes imports and exports in TypeScript/JavaScript/JSON files using regex heuristics
 */
export function analyzeFileModule(file: ProjectFile, allFiles: ProjectFile[]): ModuleDependency {
  const allPaths = allFiles.map((f) => f.path);
  const imports: ModuleDependency['imports'] = [];
  const exports: string[] = [];

  const content = file.content || '';

  // Match: import { a, b } from './module'; import defaultExport from 'package'; import * as x from 'y';
  const importRegex = /import\s+(?:(?:\*\s+as\s+([A-Za-z0-9_$]+)|([A-Za-z0-9_$]+)|(?:\{([^}]+)\}))\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    const defaultImport = match[2]?.trim();
    const namedImports = match[3]
      ? match[3].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)
      : [];
    const namespaceImport = match[1]?.trim();
    const source = match[4];

    const specifiers: string[] = [];
    if (defaultImport) specifiers.push(defaultImport);
    if (namespaceImport) specifiers.push(`* as ${namespaceImport}`);
    specifiers.push(...namedImports);

    const isExternal = !source.startsWith('.') && !source.startsWith('src/');
    const resolvedPath = isExternal ? null : resolveInternalPath(file.path, source, allPaths);

    imports.push({
      source,
      resolvedPath,
      specifiers,
      isExternal,
    });
  }

  // Match: export const/function/class/type/interface/enum Name
  const exportDeclRegex = /export\s+(?:default\s+)?(?:const|function|class|type|interface|enum|let|var)\s+([A-Za-z0-9_$]+)/g;
  while ((match = exportDeclRegex.exec(content)) !== null) {
    if (match[1]) {
      exports.push(match[1]);
    }
  }

  // Match: export { a, b as c }
  const exportNamedRegex = /export\s+\{([^}]+)\}/g;
  while ((match = exportNamedRegex.exec(content)) !== null) {
    if (match[1]) {
      const names = match[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      exports.push(...names);
    }
  }

  return {
    path: file.path,
    imports,
    exports,
    dependents: [],
    dependencies: imports.map((i) => i.resolvedPath).filter((p): p is string => Boolean(p)),
    likelyAffectedTests: [],
  };
}

/**
 * Builds a complete cross-module dependency graph for the entire workspace
 */
export function buildWorkspaceDependencyGraph(files: ProjectFile[]): WorkspaceDependencyGraph {
  const modules: Record<string, ModuleDependency> = {};

  // First pass: Analyze all files
  for (const file of files) {
    modules[file.path] = analyzeFileModule(file, files);
  }

  // Second pass: Calculate dependents and link affected tests
  for (const [filePath, mod] of Object.entries(modules)) {
    for (const depPath of mod.dependencies) {
      if (modules[depPath] && !modules[depPath].dependents.includes(filePath)) {
        modules[depPath].dependents.push(filePath);
      }
    }
  }

  // Third pass: Link test files that test given modules
  for (const [filePath, mod] of Object.entries(modules)) {
    const isTestFile = filePath.includes('.test.') || filePath.includes('.spec.') || filePath.startsWith('tests/');
    if (isTestFile) {
      for (const depPath of mod.dependencies) {
        if (modules[depPath] && !modules[depPath].likelyAffectedTests.includes(filePath)) {
          modules[depPath].likelyAffectedTests.push(filePath);
        }
      }
    }
  }

  // Check circular dependencies
  const circularDependencies: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(curr: string, path: string[]) {
    visited.add(curr);
    stack.add(curr);

    const deps = modules[curr]?.dependencies || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        dfs(dep, [...path, dep]);
      } else if (stack.has(dep)) {
        circularDependencies.push([...path, dep]);
      }
    }

    stack.delete(curr);
  }

  for (const p of Object.keys(modules)) {
    if (!visited.has(p)) {
      dfs(p, [p]);
    }
  }

  // Find orphaned files (no dependents and not an entry point)
  const entryPoints = ['src/index.ts', 'src/index.tsx', 'src/main.tsx', 'src/App.tsx', 'package.json'];
  const orphanedFiles = Object.keys(modules).filter(
    (p) => !entryPoints.includes(p) && modules[p].dependents.length === 0 && !p.includes('.test.')
  );

  return {
    modules,
    circularDependencies,
    orphanedFiles,
  };
}

/**
 * Validates a proposed workspace file path for security (sandboxing within workspace)
 */
export function validateWorkspacePath(filePath: string): { valid: boolean; error?: string } {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'Path must be a non-empty string' };
  }

  // Prevent path traversal
  if (filePath.includes('..') || filePath.startsWith('/') || filePath.startsWith('\\') || filePath.includes(':')) {
    return { valid: false, error: `Path traversal or absolute path rejected: "${filePath}". Must be relative to project workspace.` };
  }

  // Prevent dangerous hidden directories or root escapes
  if (filePath.startsWith('.git/') || filePath.startsWith('node_modules/') || filePath.startsWith('.env')) {
    return { valid: false, error: `Protected path access rejected: "${filePath}".` };
  }

  return { valid: true };
}
