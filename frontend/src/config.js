// API Configuration (Vite)
// Use Vite env var when provided; fallback to local Flask default.
// Ensure no trailing slash to avoid double slashes in requests.
const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5001'
).replace(/\/+$/, '');

export const getApiUrl = (path, params = {}) => {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.keys(params).forEach((key) => url.searchParams.append(key, params[key]));
  return url.toString();
};

export default API_BASE_URL;

