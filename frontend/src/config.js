// API Configuration
const API_BASE_URL = 'http://localhost:5001';

export const getApiUrl = (path, params = {}) => {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  return url.toString();
};

// Export both as named and default export
export { API_BASE_URL };
export default API_BASE_URL;

