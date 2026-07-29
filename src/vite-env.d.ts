/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Firebase RTDB root URL for anonymous analytics. */
  readonly VITE_FIREBASE_RTDB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** World Magnetic Model declination (degrees, east-positive). */
declare module 'magvar' {
  export function magvar(latitudeDeg: number, longitudeDeg: number, altitudeKm?: number): number;
}
