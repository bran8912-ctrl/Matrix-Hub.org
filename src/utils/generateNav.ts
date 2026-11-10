/**
 * generateNav.ts - Build-time navigation generator for Matrix-Hub
 * 
 * This utility scans the src/pages directory and builds a navigation structure
 * based on the folder hierarchy. It extracts page titles from frontmatter when available.
 * 
 * DEPENDENCIES:
 * Install with: npm install fast-glob gray-matter
 * 
 * USAGE:
 * import { generateNavigation } from '../utils/generateNav.js';
 * const navData = await generateNavigation();
 * 
 * NAVIGATION STRUCTURE:
 * - Pages in subdirectories (e.g., src/pages/docs/) are grouped into dropdown tabs
 * - Top-level pages (e.g., src/pages/wallet.astro) get their own individual tabs
 * - Single-page tabs render as direct links; multi-page tabs render as dropdowns
 * - The root index.astro is always placed in the "Home" category
 * 
 * CUSTOMIZATION TIPS:
 * - To exclude additional folders, add them to EXCLUDED_PATHS
 * - To customize tab order, modify the sortTabs() function
 * - To change how titles are extracted, update extractPageMetadata()
 * - Use 'navCategory' in frontmatter to override a page's category
 * - To group multiple top-level pages: add 'navCategory: "tools"' to their frontmatter
 *   or move them into a subdirectory (e.g., src/pages/tools/)
 */

import fg from 'fast-glob';
import fs from 'fs';
import path from 'path';
// Note: fileURLToPath is not needed in current implementation
// import { fileURLToPath } from 'url';

// Note: __filename and __dirname are defined but not used in current implementation
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Paths and files to exclude from navigation
// These exclusions hide at-risk content, private portals, and internal infrastructure
const EXCLUDED_PATHS = [
  // API Routes & Backend Infrastructure
  '**/api/**',                    // API endpoints (handled separately from navigation)
  '**/api.{astro,ts,js,tsx,jsx}', // API files in pages root
  
  // Private & Admin Portals
  '**/owners.astro',              // Owners portal - direct URL access only
  '**/owners/**',                 // Owner tools (e.g. deploy console) - direct URL access only, never in nav
  '**/admin/**',                  // Admin section
  '**/admin.{astro,ts,tsx}',      // Admin pages
  '**/internal/**',               // Internal use only
  '**/private/**',                // Private content
  
  // Development & Debug Files
  '**/_*.{astro,md,mdx,ts,tsx}',  // Files starting with underscore (draft/internal)
  '**/_.{astro,md,mdx,tsx}/**',   // Directories starting with underscore
  '**/debug*',                    // Debug pages
  '**/test*',                     // Test pages
  
  // System & Configuration
  '**/sitemap*',                  // Sitemap (auto-generated, not for nav)
  '**/robots*',                   // Robots.txt (auto-generated)
  '**/config/**',                 // Configuration pages
  '**/settings/**',               // Settings (if user-restricted)
];

interface PageMetadata {
  title: string;
  navCategory: string | null;
  navExclude: boolean;
}

interface NavigationPage {
  title: string;
  path: string;
  isIndex: boolean;
}

interface NavigationTab {
  id: string;
  label: string;
  pages: NavigationPage[];
}

/**
 * Extract title and navCategory from frontmatter or generate from filename
 * This combines reading operations to avoid duplicate file I/O
 * @param filePath - Path to the file
 * @returns Page metadata including title and custom category
 */
function extractPageMetadata(filePath: string): PageMetadata {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extract title and navCategory from Astro frontmatter
    // Look for patterns like: export const title = "..."
    let title: string | null = null;
    let navCategory: string | null = null;
    let navExclude = false;
    
    // Try to extract from frontmatter block (between --- markers)
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      
      // Match: export const title = "..."
      const titleMatch = frontmatter.match(/export\s+const\s+title\s*=\s*["']([^"']+)["']/);
      if (titleMatch) {
        title = titleMatch[1];
      }
      
      // Match: export const navCategory = "..."
      const categoryMatch = frontmatter.match(/export\s+const\s+navCategory\s*=\s*["']([^"']+)["']/);
      if (categoryMatch) {
        navCategory = categoryMatch[1];
      }

      // Match: export const navExclude = true
      navExclude = /export\s+const\s+navExclude\s*=\s*true/.test(frontmatter);
    }
    
    // Fallback: generate title from filename if not found
    if (!title) {
      const fileName = path.basename(filePath, path.extname(filePath));
      
      // Special case for index files
      if (fileName === 'index') {
        title = 'Overview';
      } else {
        // Convert kebab-case or snake_case to Title Case
        title = fileName
          .replace(/[-_]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
    
    return { title, navCategory, navExclude };
  } catch (error) {
    console.warn(`Warning: Could not extract metadata from ${filePath}:`, (error as Error).message);
    // Fallback to filename
    const fileName = path.basename(filePath, path.extname(filePath));
    return {
      title: fileName.charAt(0).toUpperCase() + fileName.slice(1),
      navCategory: null,
      navExclude: false,
    };
  }
}

/**
 * Convert file path to URL path
 * @param filePath - File path relative to src/pages
 * @returns URL path
 */
function filePathToUrlPath(filePath: string): string {
  // Remove file extension
  let urlPath = filePath.replace(/\.(astro|md|mdx)$/, '');
  
  // Remove 'index' from end of path (handles nested index files like games/casino/index.astro)
  urlPath = urlPath.replace(/\/index$/, '') || '/';
  
  // Ensure leading slash
  if (!urlPath.startsWith('/')) {
    urlPath = '/' + urlPath;
  }
  
  return urlPath;
}

/**
 * Sort tabs in a specific order
 * @param tabs - Array of tab objects
 * @returns Sorted tabs
 */
function sortTabs(tabs: NavigationTab[]): NavigationTab[] {
  // Define preferred order for navigation tabs
  const order = ['home', 'casino', 'mtx-token', 'leaderboards', 'useful-tools', 'resources', 'dao'];
  
  return tabs.sort((a, b) => {
    const aIndex = order.indexOf(a.id.toLowerCase());
    const bIndex = order.indexOf(b.id.toLowerCase());
    
    // If both are in order list, sort by order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // If only a is in order list, it comes first
    if (aIndex !== -1) return -1;
    
    // If only b is in order list, it comes first
    if (bIndex !== -1) return 1;
    
    // Otherwise, sort alphabetically
    return a.label.localeCompare(b.label);
  });
}

/**
 * Generate navigation structure from pages directory
 * @returns Navigation structure
 */
export async function generateNavigation(): Promise<NavigationTab[]> {
  const pagesDir = path.join(process.cwd(), 'src/pages');
  
  // Find all page files, excluding specified paths
  const pattern = '**/*.{astro,md,mdx}';
  const files = await fg(pattern, {
    cwd: pagesDir,
    ignore: EXCLUDED_PATHS,
  });
  
  // Build navigation structure
  const navMap = new Map<string, NavigationTab>();
  
  for (const file of files) {
    const fullPath = path.join(pagesDir, file);
    const { title, navCategory, navExclude } = extractPageMetadata(fullPath);
    const urlPath = filePathToUrlPath(file);

    // Skip pages that have opted out of navigation
    if (navExclude) continue;
    
    // Determine category
    let category: string;
    
    if (navCategory) {
      // Use custom category from frontmatter
      category = navCategory;
    } else if (file === 'index.astro') {
      // Root index is home
      category = 'home';
    } else if (file.includes('/')) {
      // Get top-level directory as category
      category = file.split('/')[0];
    } else {
      // Top-level pages (not in a folder) go to their own category
      // e.g., wallet.astro -> 'wallet' category, buy-mtx.astro -> 'buy-mtx' category
      // 
      // DESIGN NOTE: Each top-level page gets its own tab/category. While this creates
      // single-page tabs (which render as direct links rather than dropdowns), it provides
      // clear, prominent navigation for important standalone pages like Wallet, Buy MTX, etc.
      // 
      // CUSTOMIZATION: To group multiple top-level pages together, you can either:
      // 1. Move pages into a subdirectory (e.g., create src/pages/tools/ folder)
      // 2. Add 'navCategory: "tools"' to the frontmatter of pages you want grouped
      // 
      // Example frontmatter to group pages:
      // ---
      // title: "My Page"
      // navCategory: "tools"  # This page will appear in a "Tools" dropdown
      // ---
      const fileName = path.basename(file, path.extname(file));
      category = fileName;
    }
    
    // Initialize category if not exists
    if (!navMap.has(category)) {
      // Create a readable label for the category
      let label: string;
      if (category === 'home') {
        label = 'Home';
      } else if (category === 'casino') {
        label = 'Casino';
      } else if (category === 'mtx-token') {
        label = 'MTX Token';
      } else if (category === 'leaderboards') {
        label = 'Leaderboards';
      } else if (category === 'resources') {
        label = 'Resources';
      } else if (category === 'dao') {
        label = 'DAO';
      } else if (category === 'useful-tools') {
        label = 'Free Financial Tools';
      } else if (category === 'games') {
        label = 'Free Games';
      } else {
        // Fallback: convert kebab-case to Title Case
        label = category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      
      navMap.set(category, {
        id: category,
        label: label,
        pages: []
      });
    }
    
    // Add page to category
    // Check for index files with all supported extensions
    const isIndexFile = file.endsWith('index.astro') || 
                       file.endsWith('index.md') || 
                       file.endsWith('index.mdx') || 
                       file === 'index.astro';
    
    navMap.get(category)!.pages.push({
      title,
      path: urlPath,
      isIndex: isIndexFile
    });
  }
  
  // Convert map to array and sort
  const tabs = Array.from(navMap.values());
  
  // Sort pages within each tab (index first, then alphabetically)
  tabs.forEach(tab => {
    tab.pages.sort((a, b) => {
      if (a.isIndex && !b.isIndex) return -1;
      if (!a.isIndex && b.isIndex) return 1;
      return a.title.localeCompare(b.title);
    });
  });
  
  // Sort tabs
  return sortTabs(tabs);
}

/**
 * Get navigation data (for use in Astro components)
 * This function directly delegates to generateNavigation without caching.
 * During static site generation, Astro handles caching appropriately.
 */
export async function getNavigation(): Promise<NavigationTab[]> {
  return generateNavigation();
}
