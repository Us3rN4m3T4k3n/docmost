import { getBackendUrl } from "@/lib/config";

export const SOCKET_URL = getBackendUrl().replace(/^https?:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');