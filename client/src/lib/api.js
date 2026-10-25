const configuredBase = (import.meta.env.VITE_API_BASE_URL || "").trim();

// Empty in development so Vite's /api proxy keeps working. In production,
// set VITE_API_BASE_URL to the deployed API origin (for example https://api.example.com).
export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = configuredBase.replace(/\\/+$/, "");
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
