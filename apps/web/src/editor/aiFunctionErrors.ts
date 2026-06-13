export async function getFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = typeof error === 'object' && error !== null && 'context' in error
    ? (error as { context?: unknown }).context
    : null;

  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === 'string' && payload.error.trim().length > 0) {
        return payload.error;
      }
      if (typeof payload?.message === 'string' && payload.message.trim().length > 0) {
        return payload.message;
      }
    } catch {
      const text = await context.clone().text().catch(() => '');
      if (text.trim().length > 0) {
        return text;
      }
    }
  }

  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}
