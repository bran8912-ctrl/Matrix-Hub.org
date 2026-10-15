# Matrix-Hub Tools Documentation

## Overview

This document provides comprehensive instructions for setup, usage, and management of the Matrix-Hub content workflow and ecosystem tools.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Content Workflow Script](#content-workflow-script)
3. [Dependencies](#dependencies)
4. [Generated Outputs](#generated-outputs)
5. [Usage Examples](#usage-examples)
6. [Owners Portal](#owners-portal)
7. [Marketing & Analytics](#marketing--analytics)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## Quick Start

### Installation

All required dependencies are included in `package.json`:

```bash
npm install
```

This installs:

- `fast-glob` (v3.3.3) - Fast file pattern matching
- `gray-matter` (v4.0.3) - Frontmatter parsing for markdown files
- `chokidar` (latest) - File system watcher for live updates

### First Run

1. Scan your content:

   ```bash
   node content-workflow.js scan
   ```

2. Generate public feeds:

   ```bash
   node content-workflow.js generate
   ```

3. View analytics:

   ```bash
   node content-workflow.js analytics
   ```

---

## Content Workflow Script

### Location

`content-workflow.js` in the project root directory.

### Purpose

A comprehensive content management tool that:

- Automatically discovers and indexes content files
- Generates public JSON feeds for marketing and SEO
- Provides detailed analytics and metrics
- Watches for file changes and auto-updates
- Logs all errors for debugging

### Commands

#### 1. Scan Content

```bash
node content-workflow.js scan
```

**What it does:**

- Scans all markdown (.md), MDX (.mdx), and Astro (.astro) files
- Parses frontmatter metadata
- Counts words and collects file statistics
- Reports total files found

**Output:** Console summary of files discovered

#### 2. Generate Public Feed

```bash
node content-workflow.js generate
```

**What it does:**

- Scans content (same as scan command)
- Generates `public/public-feed.json` with:
  - File paths and titles
  - Descriptions and tags
  - Category groupings
  - Recent updates list
  - Total file counts

**Output:** `public/public-feed.json`

**Use cases:**

- Marketing team content inventory
- SEO tools and search engine indexing
- External API integrations
- Content discovery features

#### 3. Generate Analytics

```bash
node content-workflow.js analytics
```

**What it does:**

- Comprehensive content analysis including:
  - Total files, words, and size metrics
  - Category breakdowns with averages
  - Tag cloud analysis
  - Content health checks (missing metadata)

**Output:** `public/content-analytics.json`

**Use cases:**

- Investor presentations
- Content strategy planning
- Quality assurance
- Ecosystem reporting

#### 4. Watch Mode

```bash
node content-workflow.js watch
```

**What it does:**

- Monitors content directories for changes
- Auto-regenerates feeds when files are added, changed, or removed
- Debounces updates (1 second delay)
- Runs continuously until stopped (Ctrl+C)

**Output:** Live updates to both JSON files

**Use cases:**

- Development environments
- Live content editing
- Real-time feed updates
- Continuous integration

#### 5. Help

```bash
node content-workflow.js help
```

Displays usage information and command reference.

---

## Dependencies

### fast-glob

**Purpose:** Fast and efficient file pattern matching

**Usage in script:** Discovers content files across multiple directories

**Features:**

- Parallel file scanning
- Gitignore-style patterns
- Cross-platform support

### gray-matter

**Purpose:** Parse frontmatter from markdown and MDX files

**Usage in script:** Extracts metadata (title, description, tags) from files

**Features:**

- YAML, JSON, and TOML frontmatter support
- Custom delimiters
- Excerpt support

### chokidar

**Purpose:** File system watcher

**Usage in script:** Monitors file changes in watch mode

**Features:**

- Cross-platform compatibility
- Efficient CPU usage
- Debouncing support

---

## Generated Outputs

### 1. public/public-feed.json

**Structure:**

```json
{
  "generated": "2025-12-31T00:00:00.000Z",
  "totalFiles": 150,
  "categories": {
    "documentation": 45,
    "page": 20,
    "content": 75,
    "casino": 10
  },
  "recentUpdates": [
    {
      "path": "docs/example.md",
      "title": "Example Document",
      "modified": "2025-12-30T12:00:00.000Z"
    }
  ],
  "content": [
    {
      "path": "docs/example.md",
      "title": "Example Document",
      "description": "An example",
      "category": "documentation",
      "tags": ["example", "docs"],
      "modified": "2025-12-30T12:00:00.000Z",
      "wordCount": 500
    }
  ]
}
```

**Access:** `https://matrix-hub.org/public-feed.json` (when deployed)

**Uses:**

- External API consumption
- Marketing automation
- SEO tools
- Content management systems

### 2. public/content-analytics.json

**Structure:**

```json
{
  "generated": "2025-12-31T00:00:00.000Z",
  "summary": {
    "totalFiles": 150,
    "totalWords": 75000,
    "totalSize": 1500000,
    "avgWordsPerFile": 500
  },
  "categories": {
    "documentation": {
      "count": 45,
      "totalWords": 22500,
      "avgWords": 500
    }
  },
  "tagCloud": {
    "blockchain": 25,
    "casino": 15,
    "mtx": 30
  },
  "contentHealth": {
    "filesWithoutTitles": 5,
    "filesWithoutDescriptions": 10,
    "filesWithoutTags": 8
  }
}
```

**Uses:**

- Investor presentations
- Content strategy
- Quality assurance
- Performance metrics

### 3. content-workflow-errors.log

**Format:**

```
[2025-12-31T00:00:00.000Z] [context] Error message
Stack trace...
```

**Purpose:**

- Debug issues with file processing
- Track problematic content files
- Monitor script health

**Location:** Project root directory

---

## Usage Examples

### Development Workflow

```bash
# Start watch mode for live updates during content editing
node content-workflow.js watch

# In another terminal, edit your content
# Feeds will auto-update as you save files
```

### Pre-Deployment Check

```bash
# Generate fresh feeds before deploying
node content-workflow.js generate
node content-workflow.js analytics

# Verify outputs
cat public/public-feed.json
cat public/content-analytics.json
```

### Marketing Campaign Prep

```bash
# Generate analytics for campaign planning
node content-workflow.js analytics

# Review metrics
less public/content-analytics.json

# Generate public feed for external tools
node content-workflow.js generate
```

### CI/CD Integration

Add to your build scripts in `package.json`:

```json
{
  "scripts": {
    "prebuild": "node content-workflow.js generate",
    "build": "astro build"
  }
}
```

---

## Owners Portal

### Access

**URL:** `https://matrix-hub.org/owners` (or `/owners` on your local dev server)

**Access Control:** Protected via admin-configured credentials (never document real passwords here; use environment configuration or your auth provider settings).

**Important:** This page is NOT linked in site navigation - only accessible via direct URL

### Features

The Owners Portal provides:

1. **Content Workflow Management**
   - Full command reference
   - Usage instructions
   - Best practices

2. **Marketing Tools Documentation**
   - Public feed usage
   - Analytics interpretation
   - SEO optimization tips

3. **Ecosystem Information**
   - MTX token details
   - Casino features
   - Architecture overview

4. **Quick Action Checklist**
   - Step-by-step operations guide
   - Common tasks

### Security Note

Password is checked client-side for convenience. For production use with sensitive data, consider:

- Server-side authentication
- Environment variables for password
- Session management
- IP whitelisting

---

## Marketing & Analytics

### Using the Public Feed

**API Endpoint:** `/public-feed.json`

**Integration Examples:**

1. **Marketing Automation:**

   ```javascript
   fetch('https://matrix-hub.org/public-feed.json')
     .then(res => res.json())
     .then(data => {
       console.log(`Total content: ${data.totalFiles}`);
       console.log('Recent updates:', data.recentUpdates);
     });
   ```

2. **SEO Sitemap Generation:**

   ```javascript
   const feed = require('./public/public-feed.json');
   const urls = feed.content.map(item => ({
     url: item.path,
     lastmod: item.modified,
   }));
   ```

3. **Content Dashboard:**
   - Display category counts
   - Show recent updates
   - Track content growth

### Analytics Interpretation

**Key Metrics:**

1. **Total Words:** Measure of content depth
2. **Avg Words/File:** Content quality indicator
3. **Categories:** Content distribution
4. **Tag Cloud:** Topic focus areas
5. **Content Health:** Quality metrics

**Investor Presentation Points:**

- Total content volume (shows scale)
- Category diversity (shows breadth)
- Recent activity (shows momentum)
- Content health (shows quality)

---

## Troubleshooting

### Common Issues

#### 1. "Module not found" error

**Problem:** Dependencies not installed

**Solution:**

```bash
npm install
```

#### 2. No files found during scan

**Problem:** Content directories empty or patterns don't match

**Solution:**

- Check that content exists in `src/content`, `docs`, or `src/pages`
- Verify file extensions are `.md`, `.mdx`, or `.astro`
- Check `CONFIG.contentDirs` in `content-workflow.js`

#### 3. Permission errors writing output files

**Problem:** No write access to `public/` directory

**Solution:**

```bash
mkdir -p public
chmod 755 public
```

#### 4. Watch mode not detecting changes

**Problem:** File system watcher limitations

**Solution:**

- Restart watch mode
- Check file system limits: `ulimit -n`
- Reduce number of watched directories

#### 5. Error log growing too large

**Problem:** Repeated errors

**Solution:**

```bash
# Archive old log
mv content-workflow-errors.log content-workflow-errors.log.old

# Fix underlying issues causing errors
# Script will create new log automatically
```

### Debug Mode

Add verbose logging by modifying the script:

```javascript
// Add at top of content-workflow.js
const DEBUG = true;

// Add before any operation
if (DEBUG) console.log('Debug: operation details...');
```

---

## Best Practices

### Content Organization

1. **Use Frontmatter:** Always include title, description, and tags

   ```markdown
   ---
   title: "My Document"
   description: "A comprehensive guide"
   tags: ["guide", "documentation"]
   category: "docs"
   ---
   ```

2. **Consistent Categories:** Use standard category names
   - `documentation`
   - `page`
   - `content`
   - `casino`
   - `games`

3. **Meaningful Tags:** Use descriptive, searchable tags

### Workflow Automation

1. **Pre-commit Hooks:** Regenerate feeds before commits

   ```bash
   # .git/hooks/pre-commit
   #!/bin/bash
   node content-workflow.js generate
   git add public/public-feed.json public/content-analytics.json
   ```

2. **CI Integration:** Include in build pipeline

   ```yaml
   # .github/workflows/build.yml
   - name: Generate feeds
     run: node content-workflow.js generate
   ```

3. **Scheduled Updates:** Use cron for periodic regeneration

   ```bash
   # Regenerate every hour
   0 * * * * cd /path/to/project && node content-workflow.js generate
   ```

### Performance Optimization

1. **Large Repositories:**
   - Use specific patterns instead of `**/*`
   - Limit depth with patterns like `docs/*.md` instead of `docs/**/*.md`
   - Exclude unnecessary directories

2. **Watch Mode:**
   - Increase debounce delay for high-activity periods
   - Use specific directories instead of watching everything

3. **Output Size:**
   - Filter out unnecessary fields from public feed
   - Compress JSON in production
   - Use CDN for feed distribution

### Security Considerations

1. **Sensitive Content:**
   - Add to `.gitignore` if needed
   - Exclude from public feed generation
   - Use separate private feeds

2. **Error Logs:**
   - Review regularly for issues
   - Rotate logs periodically
   - Don't commit logs to repository

3. **Public Feed:**
   - Review before publishing
   - Filter out internal metadata
   - Validate JSON structure

---

## Advanced Configuration

### Environment Variables

The script can be configured via environment variables without modifying code:

```bash
# Content directories (comma-separated)
export CONTENT_DIRS="src/content,docs,blog"

# Output directory
export OUTPUT_DIR="dist/public"

# Feed file locations
export PUBLIC_FEED_FILE="dist/public/feed.json"
export ANALYTICS_FILE="dist/public/analytics.json"
export ERROR_LOG_FILE="logs/content-errors.log"

# File patterns (comma-separated)
export CONTENT_PATTERNS="**/*.md,**/*.mdx,**/*.astro"
export EXCLUDE_PATTERNS="**/node_modules/**,**/dist/**,**/.git/**"

# Run the script with custom config
node content-workflow.js generate
```

**Available environment variables:**

- `CONTENT_DIRS` - Directories to scan (default: `src/content,docs,src/pages`)
- `OUTPUT_DIR` - Output directory (default: `public`)
- `PUBLIC_FEED_FILE` - Public feed path (default: `public/public-feed.json`)
- `ANALYTICS_FILE` - Analytics file path (default: `public/content-analytics.json`)
- `ERROR_LOG_FILE` - Error log path (default: `content-workflow-errors.log`)
- `CONTENT_PATTERNS` - File patterns to match (default: `**/*.md,**/*.mdx,**/*.astro`)
- `EXCLUDE_PATTERNS` - Patterns to exclude (default: `**/node_modules/**,**/dist/**,**/.git/**`)

### Customizing Scan Patterns

Edit `CONFIG` in `content-workflow.js`:

```javascript
const CONFIG = {
  contentDirs: ['src/content', 'docs', 'blog'],  // Add/remove dirs
  patterns: [
    '**/*.md',
    '**/*.mdx',
    '**/*.astro',
    '**/*.jsx',  // Add new patterns
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    '**/private/**',  // Add exclusions
  ],
};
```

### Custom Output Formats

Extend the script with new generators:

```javascript
async function generateCustomFeed(contentData) {
  // Custom processing logic
  const customFeed = {
    // Your custom format
  };
  
  await fs.writeFile(
    'public/custom-feed.json',
    JSON.stringify(customFeed, null, 2)
  );
}
```

### Integration with Build Tools

#### Astro Integration

Add to your build scripts in `package.json`:

```json
{
  "scripts": {
    "prebuild": "node content-workflow.js generate",
    "build": "astro build"
  }
}
```

Or use an Astro integration with the `astro:build:start` hook:

```typescript
// astro.config.ts
import { defineConfig } from 'astro/config';
import { execSync } from 'child_process';

export default defineConfig({
  integrations: [
    {
      name: 'content-workflow',
      hooks: {
        'astro:build:start': async () => {
          execSync('node content-workflow.js generate', { stdio: 'inherit' });
        }
      }
    }
  ]
});
```

#### Vite Plugin

Create `vite-plugin-content-workflow.js`:

```javascript
import { execSync } from 'child_process';

export default function contentWorkflow() {
  return {
    name: 'content-workflow',
    buildStart() {
      execSync('node content-workflow.js generate', { stdio: 'inherit' });
    }
  };
}
```

---

## Support & Contact

For questions or issues:

1. Check this documentation first
2. Review error logs: `content-workflow-errors.log`
3. Check Matrix-Hub documentation in `/docs`
4. Contact the development team

---

## Version History

- **v1.0** - Initial release with scan, generate, watch, and analytics commands
- Full integration with fast-glob, gray-matter, and chokidar
- Comprehensive error logging
- Public feed and analytics generation

---

## License

Part of the Matrix-Hub.org ecosystem. See LICENSE file in project root.

---

**Matrix-Hub: Signal Over Noise** 🌟
