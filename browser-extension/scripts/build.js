#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// =============================================================================
// CONFIGURATION & TYPES
// =============================================================================

const BuildTarget = {
  DEV: 'dev',
  PREVIEW: 'preview',
  RELEASE: 'release'
};

const Browser = {
  CHROME: 'chrome',
  FIREFOX: 'firefox'
};

const Store = {
  CWS: 'cws',
  AMO: 'amo'
};

// Each store accepts packages for exactly one browser
const StoreBrowser = {
  [Store.CWS]: Browser.CHROME,
  [Store.AMO]: Browser.FIREFOX
};

// Firefox match patterns do not support port numbers, so a bare localhost
// pattern is used there and matches any port.
const LocalhostMatches = {
  [Browser.CHROME]: ['http://localhost:*/*', 'https://localhost:*/*'],
  [Browser.FIREFOX]: ['http://localhost/*', 'https://localhost/*']
};

const PRODUCTION_WEBSITE_MATCH = 'https://morphs.io/*';

// =============================================================================
// PATHS & CONSTANTS
// =============================================================================

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const buildDir = path.join(rootDir, '.build');
const distDir = path.join(rootDir, 'dist');
const packageJsonPath = path.join(rootDir, 'package.json');
const privateKeyPath = path.join(rootDir, 'private.pem');

// =============================================================================
// UTILITIES
// =============================================================================

function getLogLevelForTarget(target) {
  switch (target) {
    case BuildTarget.DEV:
      return 'debug';
    case BuildTarget.PREVIEW:
      return 'info';
    case BuildTarget.RELEASE:
      return 'warn';
    default:
      return 'warn';
  }
}

function processLoggerCode(loggerCode, config) {
  return loggerCode.replace('LOG_LEVEL_PLACEHOLDER', getLogLevelForTarget(config.target));
}

function compileTypeScript(tsCode) {
  // Use TypeScript compiler API to strip types while preserving formatting
  const ts = require('typescript');

  const compilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.None,
    removeComments: false, // Keep comments
    preserveConstEnums: true, // Keep const enums
    sourceMap: false, // No source maps
    declaration: false, // No .d.ts files
    pretty: true, // Pretty print
    newLine: ts.NewLineKind.LineFeed
  };

  const result = ts.transpileModule(tsCode, {
    compilerOptions: compilerOptions
  });

  return result.outputText;
}

function injectLoggerIntoScript(scriptPath, config) {
  const loggerPath = path.join(srcDir, 'shared', 'logger.ts');

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script file not found: ${scriptPath}`);
  }

  if (!fs.existsSync(loggerPath)) {
    throw new Error('logger.ts not found - required for build');
  }

  let scriptCode = fs.readFileSync(scriptPath, 'utf8');
  let loggerCode = fs.readFileSync(loggerPath, 'utf8');
  loggerCode = processLoggerCode(loggerCode, config);

  const combinedTypeScript = `${loggerCode}\n\n${scriptCode}`;
  return compileTypeScript(combinedTypeScript);
}

function parseArg(args, flag) {
  const index = args.findIndex(arg => arg.startsWith(flag));
  if (index === -1) {
    return null;
  }

  const arg = args[index];
  if (arg.includes('=')) {
    return arg.split('=')[1];
  }
  return args[index + 1] || null;
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function cleanDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

// =============================================================================
// BUILD CONFIG RESOLVER
// =============================================================================

function resolveBuildConfig(args) {
  const target = parseArg(args, '--target');
  const browser = parseArg(args, '--browser');
  const store = parseArg(args, '--store');
  const watch = args.includes('--watch');

  if (!target) {
    throw new Error('--target is required (dev|preview|release)');
  }

  if (!Object.values(BuildTarget).includes(target)) {
    throw new Error(`Invalid target: ${target}`);
  }

  if (browser && !Object.values(Browser).includes(browser)) {
    throw new Error(`Invalid browser: ${browser}`);
  }

  if (store && !Object.values(Store).includes(store)) {
    throw new Error(`Invalid store: ${store}`);
  }

  if (store && browser && StoreBrowser[store] !== browser) {
    throw new Error(`Store ${store} does not accept ${browser} packages`);
  }

  const resolvedBrowser = browser || (store ? StoreBrowser[store] : Browser.CHROME);
  const version = readPackageJson().version;
  const shouldPackage = target === BuildTarget.RELEASE || (target === BuildTarget.PREVIEW && store);

  return {
    target,
    browser: resolvedBrowser,
    store,
    watch,
    version,

    // Paths
    scratchDir: buildDir,
    outputDir: path.join(distDir, resolvedBrowser, target),

    // Derived properties
    shouldPreserveKey: target === BuildTarget.DEV && resolvedBrowser === Browser.CHROME,
    shouldIncludeLocalhost: target === BuildTarget.DEV,
    shouldCreateCRX: shouldPackage && resolvedBrowser === Browser.CHROME,
    shouldCreateZip: shouldPackage && resolvedBrowser === Browser.FIREFOX
  };
}

// =============================================================================
// BUILD STEPS
// =============================================================================

function processManifest(config) {
  const manifestPath = path.join(srcDir, config.browser, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Sync version from package.json
  manifest.version = config.version;

  // Handle key field
  if (config.shouldPreserveKey) {
    // Always inject key for dev builds to maintain consistent extension ID
    manifest.key =
      'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxozkFR8H/7+ldhZnXY6yNkpt2T+jWMILPlH0IJ8SSRSaA0cNdXluUlBMLrNzuuXDScPJfI3WRC9KWCIjla+oyxKxZgjgARmMLBWZIDvf5d3sE+9bxGWBq1zj2jEIDo/ROFjID6KXZ/GhvNTamr0HqyFKI0yXUiUe8WPNVhWm+w7wSQKes6Buf9f61SiE58eJeyEjqs/rsCjS7wtnRq/pq/DkSw1toLrpVI/EmM3mbDyp1Y0TcaahSKx7PD7ETd6EmZCzrXmLNiQ3kJ6vDVKzrMaolsBHBJVy6n4Qdjc50dgSqs2p6kweGcABc4VBaI1/++cI/jdgWckH9FrqQDHZsQIDAQAB';
    console.log('Added manifest key field for consistent dev extension ID');
  } else if (manifest.key) {
    delete manifest.key;
    console.log('Removed manifest key field');
  }

  const websiteMatches = config.shouldIncludeLocalhost
    ? [PRODUCTION_WEBSITE_MATCH, ...LocalhostMatches[config.browser]]
    : [PRODUCTION_WEBSITE_MATCH];

  // Handle externally_connectable (Chrome version check)
  if (manifest.externally_connectable?.matches) {
    manifest.externally_connectable.matches = websiteMatches;
    if (config.shouldIncludeLocalhost) {
      console.log('Added localhost to externally_connectable');
    }
  }

  // Handle the handshake content script (Firefox version check)
  const handshakeScript = (manifest.content_scripts || []).find(script =>
    script.js.includes('handshake.js')
  );
  if (handshakeScript) {
    handshakeScript.matches = websiteMatches;
    if (config.shouldIncludeLocalhost) {
      console.log('Added localhost to handshake content script');
    }
  }

  // Write processed manifest
  const outputManifestPath = path.join(config.scratchDir, 'manifest.json');
  fs.writeFileSync(outputManifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Processed manifest.json (${config.target} build)`);
}

function createContentScript(config) {
  const loggerPath = path.join(srcDir, 'shared', 'logger.ts');
  const sharedPath = path.join(srcDir, 'shared', 'morphic-scraper.ts');
  const browserPath = path.join(srcDir, config.browser, 'content.ts');
  const outputPath = path.join(config.scratchDir, 'content.js');

  if (!fs.existsSync(sharedPath) || !fs.existsSync(browserPath)) {
    throw new Error('Required content script files not found');
  }

  // Read and process logger
  if (!fs.existsSync(loggerPath)) {
    throw new Error('logger.ts not found - required for build');
  }

  let loggerCode = fs.readFileSync(loggerPath, 'utf8');
  loggerCode = processLoggerCode(loggerCode, config);

  const sharedCode = fs.readFileSync(sharedPath, 'utf8');
  const browserCode = fs.readFileSync(browserPath, 'utf8');
  const combinedTypeScript = `${loggerCode}\n\n${sharedCode}\n\n${browserCode}`;

  const compiledJavaScript = compileTypeScript(combinedTypeScript);
  fs.writeFileSync(outputPath, compiledJavaScript);
  console.log('Created combined content.js');
}

function createHandshakeScript(config) {
  const browserPath = path.join(srcDir, config.browser, 'handshake.ts');
  if (!fs.existsSync(browserPath)) {
    return;
  }

  const loggerPath = path.join(srcDir, 'shared', 'logger.ts');
  const sharedPath = path.join(srcDir, 'shared', 'version-handshake.ts');
  const outputPath = path.join(config.scratchDir, 'handshake.js');

  if (!fs.existsSync(loggerPath) || !fs.existsSync(sharedPath)) {
    throw new Error('Required handshake script files not found');
  }

  let loggerCode = fs.readFileSync(loggerPath, 'utf8');
  loggerCode = processLoggerCode(loggerCode, config);

  const sharedCode = fs.readFileSync(sharedPath, 'utf8');
  const browserCode = fs.readFileSync(browserPath, 'utf8');
  const combinedTypeScript = `${loggerCode}\n\n${sharedCode}\n\n${browserCode}`;

  fs.writeFileSync(outputPath, compileTypeScript(combinedTypeScript));
  console.log('Created combined handshake.js');
}

function copyAssets(config) {
  // Process and copy background.js with logger
  const backgroundPath = path.join(srcDir, config.browser, 'background.ts');

  if (fs.existsSync(backgroundPath)) {
    const backgroundCode = injectLoggerIntoScript(backgroundPath, config);
    fs.writeFileSync(path.join(config.scratchDir, 'background.js'), backgroundCode);
    console.log('Processed background.js with logger');
  }

  // Copy shared assets
  const iconPath = path.join(srcDir, 'assets', 'green-icon.png');
  if (fs.existsSync(iconPath)) {
    fs.copyFileSync(iconPath, path.join(config.scratchDir, 'green-icon.png'));
    console.log('Copied green-icon.png');
  }
}

async function packageAsCRX(config) {
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error('private.pem not found - required for CRX signing');
  }

  ensureDir(config.outputDir);

  const filename = `morphic-chrome-extension-v${config.version}.crx`;
  const crxPath = path.join(config.outputDir, filename);
  const chromeBinary = process.env.CHROME_BINARY || 'google-chrome';
  const cmd = `"${chromeBinary}" --pack-extension="${config.scratchDir}" --pack-extension-key="${privateKeyPath}"`;

  console.log(`Creating signed CRX: ${filename}`);

  return new Promise((resolve, reject) => {
    exec(cmd, error => {
      if (error) {
        console.error(`Chrome binary: ${chromeBinary}`);
        console.error('Set CHROME_BINARY env var if Chrome is not on PATH');
        reject(error);
        return;
      }

      // Move from .build/../.build.crx to dist/target/
      const sourceCrxPath = path.join(config.scratchDir, '..', '.build.crx');
      if (fs.existsSync(sourceCrxPath)) {
        fs.renameSync(sourceCrxPath, crxPath);
        console.log(`✅ Signed CRX created: dist/${config.target}/${filename}`);
        resolve();
      } else {
        reject(new Error('Chrome failed to create CRX file'));
      }
    });
  });
}

async function packageAsZip(config) {
  ensureDir(config.outputDir);

  const filename = `morphic-firefox-extension-v${config.version}.zip`;
  const zipPath = path.join(config.outputDir, filename);

  console.log(`Creating zip: ${filename}`);

  return new Promise((resolve, reject) => {
    exec(`cd "${config.scratchDir}" && zip -r -X "${zipPath}" .`, error => {
      if (error) {
        reject(error);
        return;
      }
      console.log(`✅ Zip created: dist/${config.browser}/${config.target}/${filename}`);
      resolve();
    });
  });
}

async function copyUnpackedPreview(config) {
  const unpackedDir = path.join(config.outputDir, 'unpacked');
  cleanDir(unpackedDir);

  fs.readdirSync(config.scratchDir).forEach(file => {
    fs.copyFileSync(path.join(config.scratchDir, file), path.join(unpackedDir, file));
  });

  console.log('✅ Preview unpacked copy created for testing');
  console.log(`📋 Load temporary add-on from: dist/${config.browser}/${config.target}/unpacked/`);
}

async function extractPreview(config) {
  const unpackedDir = path.join(config.outputDir, 'unpacked');
  cleanDir(unpackedDir);

  // Find the CRX file
  const crxFiles = fs.readdirSync(config.outputDir).filter(f => f.endsWith('.crx'));
  if (crxFiles.length === 0) {
    throw new Error('No CRX file found to extract');
  }

  const crxPath = path.join(config.outputDir, crxFiles[0]);

  // Extract CRX to unpacked directory
  const { exec } = require('child_process');

  return new Promise(resolve => {
    exec(`cd "${unpackedDir}" && unzip -q "${crxPath}"`, error => {
      if (error) {
        console.error('Warning: CRX extraction failed, but this is normal (CRX header)');
      }

      // Add key field to extracted manifest for consistent local testing
      const manifestPath = path.join(unpackedDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest.key =
          'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxozkFR8H/7+ldhZnXY6yNkpt2T+jWMILPlH0IJ8SSRSaA0cNdXluUlBMLrNzuuXDScPJfI3WRC9KWCIjla+oyxKxZgjgARmMLBWZIDvf5d3sE+9bxGWBq1zj2jEIDo/ROFjID6KXZ/GhvNTamr0HqyFKI0yXUiUe8WPNVhWm+w7wSQKes6Buf9f61SiE58eJeyEjqs/rsCjS7wtnRq/pq/DkSw1toLrpVI/EmM3mbDyp1Y0TcaahSKx7PD7ETd6EmZCzrXmLNiQ3kJ6vDVKzrMaolsBHBJVy6n4Qdjc50dgSqs2p6kweGcABc4VBaI1/++cI/jdgWckH9FrqQDHZsQIDAQAB';
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log('Added key field to unpacked manifest for consistent local testing');
      }

      console.log('✅ Preview CRX extracted for testing');
      console.log(
        `📋 Load unpacked extension from: dist/${config.browser}/${config.target}/unpacked/`
      );
      resolve();
    });
  });
}

async function copyToOutput(config) {
  ensureDir(config.outputDir);

  // Copy all files from scratch to output
  const files = fs.readdirSync(config.scratchDir);
  files.forEach(file => {
    const srcPath = path.join(config.scratchDir, file);
    const destPath = path.join(config.outputDir, file);
    fs.copyFileSync(srcPath, destPath);
  });

  console.log(`✅ Build output copied to: dist/${config.browser}/${config.target}/`);
}

// =============================================================================
// ORCHESTRATION
// =============================================================================

async function build(config) {
  const buildTypeDesc = config.store
    ? `${config.target} (${config.store})`
    : `${config.target} (${config.browser})`;

  console.log(`\nBuilding ${config.browser} extension v${config.version} - ${buildTypeDesc}\n`);

  // Clean scratch directory
  cleanDir(config.scratchDir);

  // Clean output directory to remove stale artifacts
  if (fs.existsSync(config.outputDir)) {
    fs.rmSync(config.outputDir, { recursive: true, force: true });
    console.log(`Cleaned stale artifacts from: dist/${config.browser}/${config.target}/`);
  }

  // Build in scratch directory
  processManifest(config);
  createContentScript(config);
  createHandshakeScript(config);
  copyAssets(config);

  console.log('\nBuild complete');

  if (config.shouldCreateCRX) {
    // Package as CRX (outputs to dist/target/)
    await packageAsCRX(config);

    // For preview builds, extract the CRX for testing
    if (config.target === BuildTarget.PREVIEW) {
      await extractPreview(config);
    }
  } else if (config.shouldCreateZip) {
    await packageAsZip(config);

    if (config.target === BuildTarget.PREVIEW) {
      await copyUnpackedPreview(config);
    }
  } else {
    // For dev builds, copy unpacked files to output
    await copyToOutput(config);
  }

  // Final status
  if (config.target === BuildTarget.RELEASE) {
    console.log('📦 Ready for store upload');
  } else if (config.target === BuildTarget.PREVIEW) {
    console.log('🔍 Ready for production testing');
  } else {
    console.log('✅ Ready for development');
    console.log(`Load unpacked extension from: dist/${config.browser}/${config.target}/`);
  }
}

async function watch(config) {
  console.log('👀 Watching for changes...\n');

  await build(config);

  fs.watch(srcDir, { recursive: true }, async (eventType, filename) => {
    if (filename) {
      console.log(`\n📝 Changed: ${filename}`);
      await build(config);
    }
  });
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  try {
    const config = resolveBuildConfig(process.argv.slice(2));

    if (config.watch) {
      await watch(config);
    } else {
      await build(config);
    }
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();
