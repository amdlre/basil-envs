import type { ZodError } from 'zod';

/** First error message per top-level field (messages are translation keys). */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field !== undefined && !(String(field) in result)) result[String(field)] = issue.message;
  }
  return result;
}
