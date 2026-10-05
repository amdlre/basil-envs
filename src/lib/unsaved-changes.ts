/** Module-level registry so unrelated components (e.g. the language switcher) can check. */
const dirtySources = new Set<string>();

export function setUnsavedChanges(source: string, dirty: boolean): void {
  if (dirty) dirtySources.add(source);
  else dirtySources.delete(source);
}

export function hasUnsavedChanges(): boolean {
  return dirtySources.size > 0;
}
