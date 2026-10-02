declare module "buffer" {
  export const Buffer: any;
}

declare const global: typeof globalThis & { Buffer: any };

