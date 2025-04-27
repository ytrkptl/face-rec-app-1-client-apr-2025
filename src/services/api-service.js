let baseURLForApi;

if (import.meta.env.MODE === "production") {
  baseURLForApi = import.meta?.env?.VITE_PROD_BASE_API_URL || "https://www.face-rec-app-api.yatrik.dev";
} else {
  baseURLForApi = import.meta?.env?.VITE_DEV_ONLY_BASE_API_URL || "http://localhost:5000";
}

export const apiFetch = async (endpoint, options = {}) => {
  const url = `${baseURLForApi}/api/${endpoint}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};
