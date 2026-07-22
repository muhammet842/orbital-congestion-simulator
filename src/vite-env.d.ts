/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Firebase RTDB root URL for anonymous analytics. */
  readonly VITE_FIREBASE_RTDB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
