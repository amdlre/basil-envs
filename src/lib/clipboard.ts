/**
 * Copies text that may still be loading (e.g. a value being decrypted on the server).
 * Safari only allows clipboard writes that *start* inside the user gesture, so a pending
 * value is handed over as a ClipboardItem promise instead of awaited first.
 */
export async function copyToClipboard(source: string | Promise<string>): Promise<void> {
  if (typeof source === 'string') {
    await navigator.clipboard.writeText(source);
    return;
  }
  if (typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard.write === 'function') {
    const blob = source.then((text) => new Blob([text], { type: 'text/plain' }));
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
    return;
  }
  await navigator.clipboard.writeText(await source);
}
