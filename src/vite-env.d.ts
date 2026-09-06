

interface ImportMetaEnv {
  
  readonly VITE_FIREBASE_RTDB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'magvar' {
  export function magvar(latitudeDeg: number, longitudeDeg: number, altitudeKm?: number): number;
}
