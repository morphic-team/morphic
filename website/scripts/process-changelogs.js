#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Processes Keep a Changelog format markdown files into structured JSON
 * Supports the format: https://keepachangelog.com/en/1.0.0/
 */

// Paths relative to the current working directory (website folder when run via npm)
const CHANGELOG_PATHS = {
  'morphic': './MAIN_CHANGELOG.md',
  'service': './SERVICE_CHANGELOG.md', 
  'website': './CHANGELOG.md',
  'extension': './EXTENSION_CHANGELOG.md'
};

const USER_CHANGELOG_PATH = './USER_CHANGELOG.md';

const OUTPUT_DIR = './public/changelogs';

function parseChangelogMarkdown(content, component, sourceFilePath = null) {
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
  let linkAdded = false;
  
  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];
    const line = originalLine.trim();
    
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
      
      // Replace "this file" with link to source file if provided (only once)
      if (sourceFilePath && changelog.description && !linkAdded) {
        // Convert absolute path to GitHub-style relative path
        const githubPath = sourceFilePath.replace(/^.*\/morphic\//, '');
        const repoUrl = 'https://github.com/morphic-team/morphic/blob/main';
        const fileLink = `${repoUrl}/${githubPath}`;
        // Replace "this file" with a link to the actual file
        changelog.description = changelog.description.replace(/this file/g, `[this file](${fileLink})`);
        linkAdded = true;
      }
      
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
    if (currentVersion && currentSection && (line.startsWith('- ') || originalLine.startsWith('  -'))) {
      // Handle multi-line bullets and sub-bullets
      let content = originalLine.startsWith('  -') ? originalLine.substring(4) : line.substring(2);
      
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
        isSubItem: originalLine.startsWith('  -')
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
      const parsed = parseChangelogMarkdown(content, component, fullPath);
      
      processedChangelogs[component] = parsed;
      
      // Also save individual files for component-specific access
      const outputPath = path.join(OUTPUT_DIR, `${component}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
      
      console.log(`✓ Processed ${component} changelog (${parsed.versions.length} versions)`);
      
    } catch (error) {
      console.error(`Error processing ${component} changelog:`, error.message);
    }
  }
  
  // Process user-facing changelog
  try {
    const userChangelogPath = path.resolve(process.cwd(), USER_CHANGELOG_PATH);
    if (fs.existsSync(userChangelogPath)) {
      const userContent = fs.readFileSync(userChangelogPath, 'utf8');
      const userParsed = parseChangelogMarkdown(userContent, 'user');
      
      // Save user changelog separately
      const userOutputPath = path.join(OUTPUT_DIR, 'user.json');
      fs.writeFileSync(userOutputPath, JSON.stringify(userParsed, null, 2));
      
      console.log(`✓ Processed user-facing changelog (${userParsed.versions.length} versions)`);
    } else {
      console.warn(`Warning: User changelog not found at ${userChangelogPath}`);
    }
  } catch (error) {
    console.error(`Error processing user changelog:`, error.message);
  }
  
  // Save combined changelog
  const combinedPath = path.join(OUTPUT_DIR, 'all.json');
  fs.writeFileSync(combinedPath, JSON.stringify(processedChangelogs, null, 2));
  
  console.log(`✓ Generated combined changelog with ${Object.keys(processedChangelogs).length} components`);
  console.log(`Files saved to: ${OUTPUT_DIR}`);
}

// Run the processing
processChangelogs();