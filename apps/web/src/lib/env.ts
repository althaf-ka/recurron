const apiUrl =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:8787' : undefined)
if (
  apiUrl === undefined ||
  apiUrl === '' ||
  new URL(apiUrl).origin !== apiUrl
) {
  throw new Error('VITE_API_URL must be an API origin without a trailing slash')
}
export const API_URL = apiUrl
