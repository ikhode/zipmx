/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MERCADOPAGO_PUBLIC_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
