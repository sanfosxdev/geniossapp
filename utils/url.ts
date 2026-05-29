/**
 * Utility functions for handling application URLs.
 */

/**
 * Returns the base URL of the application.
 * Prioritizes the VITE_APP_URL environment variable if set,
 * otherwise falls back to window.location.origin.
 * This ensures correct QR code generation across environments (local, Vercel, custom domain).
 */
export const getAppUrl = (): string => {
  // Check for environment variable first (useful for production/staging overrides)
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL;
  }

  // Fallback to current window origin (works for local dev and most deployments)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
};

/**
 * Generates the full URL for a specific table's ordering page.
 * @param tableId The ID of the table.
 */
export const getTableQrUrl = (tableId: string): string => {
  const baseUrl = getAppUrl();
  return `${baseUrl}?tableId=${tableId}`;
};
