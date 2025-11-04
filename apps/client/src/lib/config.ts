import bytes from "bytes";
import { castToBoolean } from "@/lib/utils.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";

declare global {
  interface Window {
    CONFIG?: Record<string, string>;
  }
}

export function getAppName(): string {
  return "Operix";
}

export function getAppUrl(): string {
  return `${window.location.protocol}//${window.location.host}`;
}

export function getServerAppUrl(): string {
  return getConfigValue("APP_URL");
}

export function getBackendUrl(): string {
  // In production, if the client is served from the same origin as the API,
  // use relative URLs to avoid CORS issues
  // This handles the case where client and server are on the same domain
  const currentOrigin = window.location.origin;
  const serverUrl = getServerAppUrl();
  
  // If no server URL is configured, use relative URLs (same-origin)
  if (!serverUrl) {
    return "/api";
  }
  
  try {
    const serverUrlObj = new URL(serverUrl);
    
    // If server URL matches current origin, use relative URLs (same-origin)
    if (serverUrlObj.origin === currentOrigin) {
      return "/api";
    }
    
    // If server URL is different, check if it's a Railway domain
    // and we're also on a Railway domain - use relative URLs to avoid CORS
    const isRailwayDomain = currentOrigin.includes('railway.app') || currentOrigin.includes('railway.com');
    const serverIsRailwayDomain = serverUrlObj.hostname.includes('railway.app') || serverUrlObj.hostname.includes('railway.com');
    
    // If both are Railway domains but different, use relative URLs
    // (client and server are on same Railway deployment)
    if (isRailwayDomain && serverIsRailwayDomain) {
      return "/api";
    }
    
    // Otherwise, use the configured server URL (cross-origin)
    return serverUrl + "/api";
  } catch {
    // If URL parsing fails, use relative URLs as fallback
    return "/api";
  }
}

export function getCollaborationUrl(): string {
  const baseUrl =
    getConfigValue("COLLAB_URL") ||
    (import.meta.env.DEV ? process.env.APP_URL : getAppUrl());

  const collabUrl = new URL("/collab", baseUrl);
  collabUrl.protocol = collabUrl.protocol === "https:" ? "wss:" : "ws:";
  return collabUrl.toString();
}

export function getSubdomainHost(): string {
  return getConfigValue("SUBDOMAIN_HOST");
}

export function isCloud(): boolean {
  return castToBoolean(getConfigValue("CLOUD"));
}

export function getAvatarUrl(
  avatarUrl: string,
  type: AvatarIconType = AvatarIconType.AVATAR,
) {
  if (!avatarUrl) return null;
  if (avatarUrl?.startsWith("http")) return avatarUrl;

  return getBackendUrl() + `/attachments/img/${type}/` + encodeURI(avatarUrl);
}

export function getSpaceUrl(spaceSlug: string) {
  return "/s/" + spaceSlug;
}

export function getFileUrl(src: string) {
  if (!src) return src;
  if (src.startsWith("http")) return src;
  if (src.startsWith("/api/")) {
    // Remove the '/api' prefix
    return getBackendUrl() + src.substring(4);
  }
  if (src.startsWith("/files/")) {
    return getBackendUrl() + src;
  }
  return src;
}

export function getFileUploadSizeLimit() {
  const limit = getConfigValue("FILE_UPLOAD_SIZE_LIMIT", "50mb");
  return bytes(limit);
}

export function getFileImportSizeLimit() {
  const limit = getConfigValue("FILE_IMPORT_SIZE_LIMIT", "200mb");
  return bytes(limit);
}

export function getDrawioUrl() {
  return getConfigValue("DRAWIO_URL", "https://embed.diagrams.net");
}

export function getBillingTrialDays() {
  return getConfigValue("BILLING_TRIAL_DAYS");
}

export function getPostHogHost() {
  return getConfigValue("POSTHOG_HOST");
}

export function isPostHogEnabled(): boolean {
  return Boolean(getPostHogHost() && getPostHogKey());
}

export function getPostHogKey() {
  return getConfigValue("POSTHOG_KEY");
}

function getConfigValue(key: string, defaultValue: string = undefined): string {
  const rawValue = import.meta.env.DEV
    ? process?.env?.[key]
    : window?.CONFIG?.[key];
  return rawValue ?? defaultValue;
}
