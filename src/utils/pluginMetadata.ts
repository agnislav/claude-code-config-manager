import * as os from 'os';
import * as path from 'path';
import { USER_SETTINGS_DIR, PLUGINS_DIR, PLUGINS_REGISTRY_FILE } from '../constants';
import { readJsonFile } from './json';

interface InstalledPluginEntry {
  scope: string;
  installPath: string;
  version: string;
}

interface InstalledPluginsRegistry {
  version: number;
  plugins: Record<string, InstalledPluginEntry[]>;
}

export interface PluginManifest {
  name?: string;
  description?: string;
  author?: { name?: string } | string;
  version?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
}

export class PluginMetadataService {
  private static instance: PluginMetadataService | undefined;

  private registry: InstalledPluginsRegistry | undefined;
  private manifestCache = new Map<string, PluginManifest | null>();

  static getInstance(): PluginMetadataService {
    if (!PluginMetadataService.instance) {
      PluginMetadataService.instance = new PluginMetadataService();
    }
    return PluginMetadataService.instance;
  }

  getDescription(pluginId: string): string | undefined {
    return this.getManifest(pluginId)?.description;
  }

  getInstallPath(pluginId: string): string | undefined {
    return this.resolveInstallPath(pluginId);
  }

  getManifest(pluginId: string): PluginManifest | undefined {
    const installPath = this.resolveInstallPath(pluginId);
    if (!installPath) return undefined;

    const cached = this.manifestCache.get(installPath);
    if (cached !== undefined) return cached ?? undefined;

    const manifestPath = path.join(installPath, '.claude-plugin', 'plugin.json');
    const result = readJsonFile<PluginManifest>(manifestPath);
    const manifest = result.data.description ? result.data : null;

    this.manifestCache.set(installPath, manifest);
    return manifest ?? undefined;
  }

  invalidate(): void {
    this.registry = undefined;
    this.manifestCache.clear();
  }

  private resolveInstallPath(pluginId: string): string | undefined {
    const reg = this.loadRegistry();
    const entries = reg.plugins[pluginId];
    if (!entries || entries.length === 0) return undefined;

    // Prefer the user-scope entry
    const userEntry = entries.find((e) => e.scope === 'user');
    return (userEntry ?? entries[0]).installPath;
  }

  private loadRegistry(): InstalledPluginsRegistry {
    if (this.registry) return this.registry;

    const registryPath = path.join(
      os.homedir(),
      USER_SETTINGS_DIR,
      PLUGINS_DIR,
      PLUGINS_REGISTRY_FILE,
    );
    const result = readJsonFile<InstalledPluginsRegistry>(registryPath);
    this.registry = result.data.plugins ? result.data : { version: 2, plugins: {} };
    return this.registry;
  }
}
