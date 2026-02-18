import * as os from 'os';
import * as path from 'path';
import {
  MANAGED_PATH_LINUX,
  MANAGED_PATH_MACOS,
  MANAGED_SETTINGS_FILENAME,
  USER_SETTINGS_DIR,
  USER_SETTINGS_FILE,
} from '../constants';

export function getManagedSettingsPath(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    return path.join(MANAGED_PATH_MACOS, MANAGED_SETTINGS_FILENAME);
  }
  // Linux and WSL
  return path.join(MANAGED_PATH_LINUX, MANAGED_SETTINGS_FILENAME);
}

export function getUserSettingsPath(): string {
  return path.join(os.homedir(), USER_SETTINGS_DIR, USER_SETTINGS_FILE);
}

export function getUserSettingsDir(): string {
  return path.join(os.homedir(), USER_SETTINGS_DIR);
}
