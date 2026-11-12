#!/usr/bin/env node

/**
 * Matrix-Hub Content Workflow Script
 * 
 * A powerful content management tool for marketing, analytics, and updates.
 * Uses fast-glob for efficient file discovery, gray-matter for frontmatter parsing,
 * and chokidar for live file watching.
 * 
 * Features:
 * - Content discovery and indexing
 * - Public JSON feed generation
 * - Analytics and reporting
 * - Live file watching for automatic updates
 * - Comprehensive error logging
 * 
 * Usage:
 *   node content-workflow.js [command] [options]
 * 
 * Commands:
 *   scan       - Scan and index content files
 *   generate   - Generate public JSON feeds
 *   watch      - Watch for file changes and auto-update
 *   analytics  - Generate content analytics report
 *   help       - Show this help message
 */

import fg from 'fast-glob';
import matter from 'gray-matter';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

// Configuration - can be overridden via environment variables
const CONFIG = {
  contentDirs: process.env.CONTENT_DIRS?.split(',') || ['src/content', 'docs', 'src/pages'],
  outputDir: process.env.OUTPUT_DIR || 'public',
  publicFeedFile: process.env.PUBLIC_FEED_FILE || 'public/public-feed.json',
  analyticsFile: process.env.ANALYTICS_FILE || 'public/content-analytics.json',
  errorLogFile: process.env.ERROR_LOG_FILE || 'content-workflow-errors.log',
  patterns: process.env.CONTENT_PATTERNS?.split(',') || [
    '**/*.md',
    '**/*.mdx',
    '**/*.astro',
  ],
  excludePatterns: process.env.EXCLUDE_PATTERNS?.split(',') || [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    '**/src/components/**',
    '**/src/casino/**',
    '**/src/utils/**',
    '**/src/layouts/**',
  ],
};

// Error logging utility with basic queue to handle concurrent writes
let logQueue = Promise.resolve();

async function logError(error, context = '') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${context ? `[${context}] ` : ''}${error.message}\n${error.stack}\n\n`;
  
  // Queue the write operation to prevent race conditions
  logQueue = logQueue.then(async () => {
    try {
      await fs.appendFile(CONFIG.errorLogFile, logMessage);
      console.error(`❌ Error logged: ${error.message}`);
    } catch (logErr) {
      console.error('Failed to write to error log:', logErr);
    }
  });
  
  return logQueue;
}

// Ensure output directory exists
async function ensureOutputDir() {
  try {
    await fs.mkdir(CONFIG.outputDir, { recursive: true });
  } catch (error) {
    await logError(error, 'ensureOutputDir');
    throw error;
  }
}

// Scan content files
async function scanContent() {
  console.log('🔍 Scanning content files...');
  
  try {
    const files = await fg(CONFIG.patterns, {
      ignore: CONFIG.excludePatterns,
      absolute: false,
    });
    
    console.log(`✅ Found ${files.length} content files`);
    
    const contentData = [];
    const failedFiles = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        // Astro files use --- fences for TypeScript/JavaScript frontmatter,
        // not YAML. gray-matter throws on those, so fall back to treating
        // the whole file as content with no frontmatter data.
        let parsed;
        try {
          parsed = matter(content);
        } catch {
          parsed = { data: {}, content };
        }
        
        const fileStats = await fs.stat(file);
        
        contentData.push({
          path: file,
          title: parsed.data.title || path.basename(file, path.extname(file)),
          description: parsed.data.description || '',
          tags: parsed.data.tags || [],
          category: parsed.data.category || inferCategory(file),
          modified: fileStats.mtime,
          created: fileStats.birthtime,
          size: fileStats.size,
          wordCount: parsed.content.trim().split(/\s+/).filter(Boolean).length,
          frontmatter: parsed.data,
        });
      } catch (error) {
        await logError(error, `Processing file: ${file}`);
        failedFiles.push(file);
        // Continue processing other files
      }
    }
    
    if (failedFiles.length > 0) {
      console.warn(`⚠️  ${failedFiles.length} file(s) failed to process. Check error log for details.`);
    }
    
    return contentData;
  } catch (error) {
    await logError(error, 'scanContent');
    throw error;
  }
}

/**
 * Infer category from file path
 * 
 * Returns one of the following category values based on the file path:
 * - 'documentation': Files in /docs/ directory
 * - 'page': Files in /pages/ directory
 * - 'content': Files in /content/ directory
 * - 'casino': Files in /casino/ directory
 * - 'games': Files in /games/ directory
 * - 'other': All other files (default catch-all)
 * 
 * @param {string} filePath - The path to the file
 * @returns {string} The inferred category name
 */
function inferCategory(filePath) {
  if (filePath.includes('/docs/')) return 'documentation';
  if (filePath.includes('/pages/')) return 'page';
  if (filePath.includes('/content/')) return 'content';
  if (filePath.includes('/casino/')) return 'casino';
  if (filePath.includes('/games/')) return 'games';
  return 'other';
}

// Generate public JSON feed
async function generatePublicFeed(contentData) {
  console.log('📝 Generating public feed...');
  
  try {
    await ensureOutputDir();
    
    // Filter and format data for public consumption
    const publicFeed = {
      generated: new Date().toISOString(),
      totalFiles: contentData.length,
      categories: {},
      recentUpdates: [],
      content: contentData.map(item => ({
        path: item.path,
        title: item.title,
        description: item.description,
        category: item.category,
        tags: item.tags,
        modified: item.modified,
        wordCount: item.wordCount,
      })),
    };
    
    // Group by category
    for (const item of contentData) {
      if (!publicFeed.categories[item.category]) {
        publicFeed.categories[item.category] = 0;
      }
      publicFeed.categories[item.category]++;
    }
    
    // Get recent updates (last 10)
    publicFeed.recentUpdates = contentData
      .sort((a, b) => new Date(b.modified) - new Date(a.modified))
      .slice(0, 10)
      .map(item => ({
        path: item.path,
        title: item.title,
        modified: item.modified,
      }));
    
    await fs.writeFile(
      CONFIG.publicFeedFile,
      JSON.stringify(publicFeed, null, 2),
      'utf-8'
    );
    
    console.log(`✅ Public feed generated: ${CONFIG.publicFeedFile}`);
    return publicFeed;
  } catch (error) {
    await logError(error, 'generatePublicFeed');
    throw error;
  }
}

// Generate analytics report
async function generateAnalytics(contentData) {
  console.log('📊 Generating analytics...');
  
  try {
    await ensureOutputDir();
    
    const totalWords = contentData.reduce((sum, item) => sum + item.wordCount, 0);
    const totalSize = contentData.reduce((sum, item) => sum + item.size, 0);
    
    const analytics = {
      generated: new Date().toISOString(),
      summary: {
        totalFiles: contentData.length,
        totalWords: totalWords,
        totalSize: totalSize,
        avgWordsPerFile: contentData.length > 0
          ? Math.round(totalWords / contentData.length)
          : 0,
      },
      categories: {},
      tagCloud: {},
      contentHealth: {
        filesWithoutTitles: 0,
        filesWithoutDescriptions: 0,
        filesWithoutTags: 0,
      },
    };
    
    // Analyze by category
    for (const item of contentData) {
      const cat = item.category;
      if (!analytics.categories[cat]) {
        analytics.categories[cat] = {
          count: 0,
          totalWords: 0,
          avgWords: 0,
        };
      }
      analytics.categories[cat].count++;
      analytics.categories[cat].totalWords += item.wordCount;
    }
    
    // Calculate averages
    for (const cat in analytics.categories) {
      analytics.categories[cat].avgWords = Math.round(
        analytics.categories[cat].totalWords / analytics.categories[cat].count
      );
    }
    
    // Build tag cloud
    for (const item of contentData) {
      for (const tag of item.tags) {
        analytics.tagCloud[tag] = (analytics.tagCloud[tag] || 0) + 1;
      }
    }
    
    // Content health check
    for (const item of contentData) {
      if (!item.title || item.title === path.basename(item.path, path.extname(item.path))) {
        analytics.contentHealth.filesWithoutTitles++;
      }
      if (!item.description) {
        analytics.contentHealth.filesWithoutDescriptions++;
      }
      if (item.tags.length === 0) {
        analytics.contentHealth.filesWithoutTags++;
      }
    }
    
    await fs.writeFile(
      CONFIG.analyticsFile,
      JSON.stringify(analytics, null, 2),
      'utf-8'
    );
    
    console.log(`✅ Analytics generated: ${CONFIG.analyticsFile}`);
    console.log('\n📊 Summary:');
    console.log(`   Total Files: ${analytics.summary.totalFiles}`);
    console.log(`   Total Words: ${analytics.summary.totalWords.toLocaleString()}`);
    console.log(`   Avg Words/File: ${analytics.summary.avgWordsPerFile}`);
    console.log(`   Total Size: ${(analytics.summary.totalSize / 1024).toFixed(2)} KB`);
    
    return analytics;
  } catch (error) {
    await logError(error, 'generateAnalytics');
    throw error;
  }
}

// Watch for file changes
async function watchContent() {
  console.log('👀 Starting file watcher...');
  console.log('   Watching directories:', CONFIG.contentDirs);
  console.log('   Press Ctrl+C to stop\n');
  
  const watcher = chokidar.watch(CONFIG.patterns, {
    ignored: CONFIG.excludePatterns,
    persistent: true,
    ignoreInitial: true,
  });
  
  let updateTimeout;
  let isShuttingDown = false;
  
  const scheduleUpdate = () => {
    if (isShuttingDown) return;
    
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(async () => {
      console.log('\n🔄 Changes detected, updating feeds...');
      try {
        const contentData = await scanContent();
        await generatePublicFeed(contentData);
        await generateAnalytics(contentData);
        console.log('✅ Feeds updated successfully\n');
      } catch (error) {
        await logError(error, 'watchContent - scheduleUpdate');
      }
    }, 1000); // Debounce updates by 1 second
  };
  
  watcher
    .on('add', (path) => {
      console.log(`➕ File added: ${path}`);
      scheduleUpdate();
    })
    .on('change', (path) => {
      console.log(`📝 File changed: ${path}`);
      scheduleUpdate();
    })
    .on('unlink', (path) => {
      console.log(`➖ File removed: ${path}`);
      scheduleUpdate();
    })
    .on('error', async (error) => {
      await logError(error, 'watchContent - watcher');
    });
  
  // Graceful shutdown handling
  const gracefulShutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('\n\n🛑 Shutting down gracefully...');
    
    // Wait for any pending updates to complete
    if (updateTimeout) {
      console.log('⏳ Waiting for pending updates to complete...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!updateTimeout) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
    
    console.log('✅ Closing file watcher...');
    await watcher.close();
    console.log('👋 Goodbye!\n');
    process.exit(0);
  };
  
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

// Show help
function showHelp() {
  console.log(`
Matrix-Hub Content Workflow Script
===================================

A powerful content management tool for marketing, analytics, and updates.

COMMANDS:
  scan       Scan and index all content files
  generate   Generate public JSON feeds from content
  watch      Watch for file changes and auto-update feeds
  analytics  Generate detailed content analytics report
  help       Show this help message

USAGE:
  node content-workflow.js <command>

EXAMPLES:
  node content-workflow.js scan
  node content-workflow.js generate
  node content-workflow.js watch
  node content-workflow.js analytics

OUTPUTS:
  ${CONFIG.publicFeedFile}      Public content feed (JSON)
  ${CONFIG.analyticsFile}   Content analytics report (JSON)
  ${CONFIG.errorLogFile}       Error log file

FEATURES:
  ✓ Fast content discovery with fast-glob
  ✓ Frontmatter parsing with gray-matter
  ✓ Live file watching with chokidar
  ✓ Comprehensive error logging
  ✓ Content analytics and reporting
  ✓ Public API feed generation
  ✓ Marketing and SEO optimization data

For more information, see MATRIX-HUB-TOOLS.md
  `);
}

// Main execution
async function main() {
  const command = process.argv[2] || 'help';
  
  try {
    switch (command) {
      case 'scan':
        const contentData = await scanContent();
        console.log(`\n✅ Scan complete: ${contentData.length} files processed`);
        break;
        
      case 'generate':
        const data = await scanContent();
        await generatePublicFeed(data);
        console.log('\n✅ Feed generation complete');
        break;
        
      case 'watch':
        await watchContent();
        break;
        
      case 'analytics':
        const analyticsData = await scanContent();
        await generateAnalytics(analyticsData);
        console.log('\n✅ Analytics generation complete');
        break;
        
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    await logError(error, 'main');
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  void main();
}

export { scanContent, generatePublicFeed, generateAnalytics, watchContent };
