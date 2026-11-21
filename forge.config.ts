import type { ForgeConfig } from '@electron-forge/shared-types';
import {
  MakerSquirrel,
  type MakerSquirrelConfig,
} from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

type SquirrelMakerConfigWithAdditionalFiles = MakerSquirrelConfig & {
  additionalFiles: Array<{ src: string; target: string }>;
};

const squirrelMakerConfig = {
  iconUrl:
    'https://raw.githubusercontent.com/DaniHRE/animonkey-electron/c82681ba65a9bcd1fc2b6630f71200d610541c2c/src/assets/brand/animonkey-app-icon.ico',
  setupIcon: path.resolve('src/assets/brand/animonkey-app-icon.ico'),
  additionalFiles: [
    {
      src: 'LICENSES.chromium.html',
      target: 'lib\\net45',
    },
  ],
} satisfies SquirrelMakerConfigWithAdditionalFiles;

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: path.resolve('src/assets/brand/animonkey-app-icon'),
    extraResource: [
      'anivexa-runtime',
      'src/assets/brand/animonkey-app-icon.png',
    ],
    win32metadata: {
      FileDescription: 'Desktop anime discovery and personal library',
      InternalName: 'Animonkey',
      OriginalFilename: 'Animonkey.exe',
      ProductName: 'Animonkey',
    },
  },
  hooks: {
    generateAssets: async (_forgeConfig, platform, arch) => {
      const script = path.resolve('scripts/prepare-anivexa-runtime.mjs');
      const result = spawnSync(process.execPath, [script, platform, arch], {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error('Failed to prepare the Anivexa runtime.');
      }
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel(squirrelMakerConfig),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
