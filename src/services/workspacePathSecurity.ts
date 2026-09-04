import fs from 'node:fs';
import path from 'node:path';

export function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath) || /^[\\/]{2}/.test(relativePath) || relativePath.includes('\\')) {
    throw new Error('Path must be a relative workspace path.');
  }
  const resolved = path.resolve(workspaceRoot, relativePath);
  const realRoot = fs.realpathSync(workspaceRoot);
  if (resolved !== workspaceRoot && !resolved.startsWith(`${workspaceRoot}${path.sep}`)) {
    throw new Error('Path escapes the authorized workspace.');
  }
  let current = workspaceRoot;
  for (const segment of path.relative(workspaceRoot, resolved).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && !fs.realpathSync(current).startsWith(`${realRoot}${path.sep}`)) {
      throw new Error('Path escapes the authorized workspace through a symlink.');
    }
  }
  return resolved;
}
