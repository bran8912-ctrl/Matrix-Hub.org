// scripts/polygon-error-bot.js
import fs from 'fs';
import path from 'path';
import { parse } from '@typescript-eslint/parser';

console.log('🤖 Matrix-Hub Bot: Running Polygon & Site Error Scan...');

let errorsFound = 0;
let warningsFound = 0;

// 1. Check for Polygon Network configuration file
const configPaths = ['src/config/mtx.ts', 'src/config/casino.ts'];
let configFound = false;

configPaths.forEach(p => {
  if (fs.existsSync(p)) {
    configFound = true;
    const content = fs.readFileSync(p, 'utf8');
    
    // Check Chain ID
    if (content.includes('0x89') || content.includes('137')) {
      console.log(`✅ Polygon Chain ID verified in ${p}`);
    } else {
      console.warn(`⚠️ Warning: Polygon Chain ID (0x89 / 137) not explicitly found in ${p}. Check your network configuration.`);
      warningsFound++;
    }

    // Check for deprecated MATIC vs current POL native currency symbol
    if (content.includes('MATIC') && !content.includes('POL')) {
      console.warn(`⚠️ Notice: Found 'MATIC' symbol reference in ${p}. Polygon network migrated native gas token to 'POL'. Consider updating references.`);
      warningsFound++;
    }
  }
});

if (!configFound) {
  console.error('❌ Error: No Polygon configuration file found in src/config/mtx.ts or src/config/casino.ts.');
  errorsFound++;
}

// 2. Scan Astro pages for SSR/Client window reference build crashes
const pagesDir = path.join('src', 'pages');
const isWindowDefinedCheck = (node, defined) => {
  if (node?.type !== 'BinaryExpression' || !['!==', '!=', '===', '=='].includes(node.operator)) {
    return false;
  }

  const isWindowTypeof = expression =>
    expression?.type === 'UnaryExpression'
    && expression.operator === 'typeof'
    && expression.argument?.type === 'Identifier'
    && expression.argument.name === 'window';
  const isUndefined = expression =>
    expression?.type === 'Literal'
    && expression.value === 'undefined';
  const isDefinedComparison = ['!==', '!='].includes(node.operator);

  return (isWindowTypeof(node.left) && isUndefined(node.right)
    || isUndefined(node.left) && isWindowTypeof(node.right))
    && defined === isDefinedComparison;
};

const hasUnguardedWindowEthereum = (node, windowDefined = false) => {
  if (!node || typeof node !== 'object') return false;

  if (node.type === 'MemberExpression'
    && !node.computed
    && node.object?.type === 'Identifier'
    && node.object.name === 'window'
    && node.property?.type === 'Identifier'
    && node.property.name === 'ethereum') {
    return !windowDefined;
  }

  if (node.type === 'LogicalExpression') {
    return hasUnguardedWindowEthereum(node.left, windowDefined)
      || hasUnguardedWindowEthereum(
        node.right,
        windowDefined || node.operator === '&&' && isWindowDefinedCheck(node.left, true),
      );
  }

  if (node.type === 'ConditionalExpression' || node.type === 'IfStatement') {
    const definedWhenTrue = isWindowDefinedCheck(node.test, true);
    const definedWhenFalse = isWindowDefinedCheck(node.test, false);
    return hasUnguardedWindowEthereum(node.test, windowDefined)
      || hasUnguardedWindowEthereum(node.consequent, windowDefined || definedWhenTrue)
      || hasUnguardedWindowEthereum(node.alternate, windowDefined || definedWhenFalse);
  }

  return Object.values(node).some(value =>
    Array.isArray(value)
      ? value.some(child => hasUnguardedWindowEthereum(child, windowDefined))
      : hasUnguardedWindowEthereum(value, windowDefined),
  );
};

if (fs.existsSync(pagesDir)) {
  const scanDir = (dir) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        scanDir(filePath);
      } else if (filePath.endsWith('.astro')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? '';
        const ast = parse(frontmatter, { sourceType: 'module', ecmaVersion: 'latest' });
        if (hasUnguardedWindowEthereum(ast)) {
          console.error(`❌ Build Risk in ${filePath}: Direct 'window.ethereum' usage in Astro frontmatter can break static builds.`);
          errorsFound++;
        }
      }
    });
  };
  scanDir(pagesDir);
  console.log('✅ Astro page structure scanned for hydration errors.');
}

// 3. Summary Report
console.log('\n--- Scan Summary ---');
console.log(`Errors: ${errorsFound}`);
console.log(`Warnings: ${warningsFound}`);

if (errorsFound > 0) {
  console.log('❌ Fix the errors above before deploying your Polygon mainnet version.');
  process.exit(1);
} else {
  console.log('✨ All Polygon structure checks passed cleanly!');
}
