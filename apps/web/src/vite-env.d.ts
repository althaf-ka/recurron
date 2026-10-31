// Describe the existing optional input without changing runtime validation.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}
