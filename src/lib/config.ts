// Backend base URL. Override at runtime via localStorage "fo_api_base", or at
// build time via NEXT_PUBLIC_API_BASE. Defaults to the local Docker backend.
export const API_BASE =
  (typeof window !== "undefined" && localStorage.getItem("fo_api_base")) ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:4000";
