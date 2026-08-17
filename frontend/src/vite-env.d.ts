/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CONEKTA_PUBLIC_KEY?: string;
  readonly VITE_AGORA_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
