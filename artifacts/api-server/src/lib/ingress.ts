/**
 * Only the local reverse proxy is trusted. Never trust arbitrary public/private
 * networks or use `trust proxy = true`: an injected leftmost XFF is not identity.
 * An unknown upstream hop deliberately stops Express's right-to-left traversal.
 */
export function trustIngressProxy(address: string) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
