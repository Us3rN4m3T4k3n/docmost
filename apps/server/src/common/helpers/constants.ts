import * as path from 'path';

export const APP_DATA_PATH = 'data';
const LOCAL_STORAGE_DIR = `${APP_DATA_PATH}/storage`;

// Use __dirname (location of the compiled file) instead of process.cwd() so the
// storage path resolves correctly regardless of which directory pnpm starts the
// server from.
//
// Compiled location: apps/server/dist/common/helpers/constants.js
// Five levels up reaches the workspace root (e.g. /app):
//   dist/common/helpers → dist/common → dist → apps/server → apps → /app
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');

export const LOCAL_STORAGE_PATH = path.resolve(WORKSPACE_ROOT, LOCAL_STORAGE_DIR);
