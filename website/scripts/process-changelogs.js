#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Processes Keep a Changelog format markdown files into structured JSON
 * Supports the format: https://keepachangelog.com/en/1.0.0/
 */

// Paths relative to the current working directory (website folder when run via npm)
const CHANGELOG_PATHS = {
  'morphic': '../CHANGELOG.md',
  'service': '../service/CHANGELOG.md', 
  'website': './CHANGELOG.md',
  'extension': '../browser-extension/CHANGELOG.md'
};

const OUTPUT_DIR = './public/changelogs';

function parseChangelogMarkdown(content, component) {
  const lines = content.split('\n');
  const changelog = {
    component,
    title: '',
    description: '',
    versions: []
  };

  let currentVersion = null;
  let currentSection = null;
  let inHeader = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Main title (# Changelog)
    if (line.startsWith('# ') && inHeader) {
      changelog.title = line.substring(2).trim();
      continue;
    }
    
    // Description paragraphs before first version
    if (inHeader && !line.startsWith('##') && !line.startsWith('# ')) {
      if (changelog.description) {
        changelog.description += '\n' + line;
      } else {
        changelog.description = line;
      }
      continue;
    }
    
    // Version header (## [1.0.1] - 2025-06-15)
    if (line.startsWith('## ')) {
      inHeader = false;
      
      // Save previous version if exists
      if (currentVersion) {
        changelog.versions.push(currentVersion);
      }
      
      // Parse version header
      const versionMatch = line.match(/^## \[([^\]]+)\]\s*-\s*(.+)$/);
      if (versionMatch) {
        currentVersion = {
          version: versionMatch[1],
          date: versionMatch[2],
          sections: {}
        };
        currentSection = null;
      }
      continue;
    }
    
    // Section header (### Added, ### Changed, etc.)
    if (line.startsWith('### ') && currentVersion) {
      const sectionName = line.substring(4).trim();
      currentSection = sectionName;
      currentVersion.sections[sectionName] = [];
      continue;
    }
    
    // Content lines
    if (currentVersion && currentSection && (line.startsWith('- ') || line.startsWith('  -'))) {
      // Handle multi-line bullets and sub-bullets
      let content = line.startsWith('- ') ? line.substring(2) : line.substring(4);
      
      // Look ahead for continuation lines
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        if (nextLine.trim() === '' || 
            nextLine.startsWith('- ') || 
            nextLine.startsWith('##') || 
            nextLine.startsWith('###')) {
          break;
        }
        if (nextLine.startsWith('  ') && !nextLine.startsWith('  -')) {
          content += '\n' + nextLine.substring(2);
          i = j; // Skip this line in main loop
        } else {
          break;
        }
        j++;
      }
      
      currentVersion.sections[currentSection].push({
        text: content.trim(),
        isSubItem: line.startsWith('  -')
      });
    }
  }
  
  // Don't forget the last version
  if (currentVersion) {
    changelog.versions.push(currentVersion);
  }
  
  return changelog;
}

function processChangelogs() {
  console.log('Processing changelog files...');
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const processedChangelogs = {};
  
  for (const [component, relativePath] of Object.entries(CHANGELOG_PATHS)) {
    const fullPath = path.resolve(process.cwd(), relativePath);
    
    try {
      if (!fs.existsSync(fullPath)) {
        console.warn(`Warning: Changelog not found for ${component} at ${fullPath}`);
        continue;
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const parsed = parseChangelogMarkdown(content, component);
      
      processedChangelogs[component] = parsed;
      
      // Also save individual files for component-specific access
      const outputPath = path.join(OUTPUT_DIR, `${component}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
      
      console.log(`✓ Processed ${component} changelog (${parsed.versions.length} versions)`);
      
    } catch (error) {
      console.error(`Error processing ${component} changelog:`, error.message);
    }
  }
  
  // Save combined changelog
  const combinedPath = path.join(OUTPUT_DIR, 'all.json');
  fs.writeFileSync(combinedPath, JSON.stringify(processedChangelogs, null, 2));
  
  console.log(`✓ Generated combined changelog with ${Object.keys(processedChangelogs).length} components`);
  console.log(`Files saved to: ${OUTPUT_DIR}`);
}

// Run the processing
processChangelogs();