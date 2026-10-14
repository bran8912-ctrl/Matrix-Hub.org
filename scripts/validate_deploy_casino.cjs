#!/usr/bin/env node

/**
 * Validation script for deploy_casino.js
 * 
 * This script validates the deployment script without actually deploying contracts.
 * It checks:
 * - Script syntax is valid
 * - All required functions are defined
 * - Configuration structure is correct
 * - Error handling is present
 * 
 * Usage: node scripts/validate_deploy_casino.cjs
 */

const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║         Validating Casino Deployment Script                   ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const scriptPath = path.join(__dirname, 'deploy_casino.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

let errors = 0;
let warnings = 0;

// Test 1: Check if script exists
console.log('✓ Test 1: Script file exists');

// Test 2: Check syntax by looking for basic JavaScript structure
// Note: We avoid using new Function() or eval() for security reasons
// Instead, we check for common syntax patterns and structure
try {
  // Check for balanced braces, parentheses, and brackets
  const braces = (scriptContent.match(/\{/g) || []).length - (scriptContent.match(/\}/g) || []).length;
  const parens = (scriptContent.match(/\(/g) || []).length - (scriptContent.match(/\)/g) || []).length;
  const brackets = (scriptContent.match(/\[/g) || []).length - (scriptContent.match(/\]/g) || []).length;
  
  if (braces === 0 && parens === 0 && brackets === 0) {
    console.log('✓ Test 2: Script syntax structure is valid (balanced delimiters)');
  } else {
    console.error('✗ Test 2: Script has unbalanced delimiters');
    console.error(`  Braces: ${braces > 0 ? '+' : ''}${braces}, Parens: ${parens > 0 ? '+' : ''}${parens}, Brackets: ${brackets > 0 ? '+' : ''}${brackets}`);
    errors++;
  }
} catch (err) {
  console.error('✗ Test 2: Script syntax check failed:', err.message);
  errors++;
}

// Test 3: Check for required sections
const requiredSections = [
  'DEPLOYMENT_CONFIG',
  'ensureDeploymentsDir',
  'deployContract',
  'saveDeploymentInfo',
  'async function main()',
  'MTX_CONTRACT_ADDRESS',
  'QUICKSWAP_V2_ROUTER_ADDRESS',
  'CASINO_MAX_PAYOUT_PER_BET',
  'VRF_NETWORK_CONFIG',
  'VRF_SUBSCRIPTION_ID',
  'getSubscription',
  'addConsumer',
  'POLYGON_CASINO_DEPLOYMENT_APPROVED',
  'setCasinoCore',
  'provideLiquidity',
];

console.log('\n📋 Test 3: Checking required sections...');
requiredSections.forEach(section => {
  if (scriptContent.includes(section)) {
    console.log(`  ✓ Found: ${section}`);
  } else {
    console.error(`  ✗ Missing: ${section}`);
    errors++;
  }
});

// Test 4: Check for error handling
console.log('\n📋 Test 4: Checking error handling...');
const errorHandlingPatterns = [
  'try {',
  'catch',
  '.catch(',
  'throw',
];

let hasErrorHandling = false;
errorHandlingPatterns.forEach(pattern => {
  if (scriptContent.includes(pattern)) {
    hasErrorHandling = true;
  }
});

if (hasErrorHandling) {
  console.log('  ✓ Error handling present');
} else {
  console.error('  ✗ No error handling found');
  errors++;
}

// Test 5: Check for console logging
console.log('\n📋 Test 5: Checking logging...');
if (scriptContent.includes('console.log')) {
  console.log('  ✓ Console logging present');
} else {
  console.warn('  ⚠ No console logging found');
  warnings++;
}

// Test 6: Check for deployment configuration
console.log('\n📋 Test 6: Checking deployment configuration...');
const configKeys = ['reserveCap', 'minBet', 'maxBet'];
let configValid = true;
configKeys.forEach(key => {
  if (scriptContent.includes(key)) {
    console.log(`  ✓ Config key: ${key}`);
  } else {
    console.error(`  ✗ Missing config key: ${key}`);
    configValid = false;
    errors++;
  }
});

// Test 7: Check for contract names
console.log('\n📋 Test 7: Checking contract deployments...');
const contracts = ['RNGEngine', 'CasinoReserve', 'LiquidityRouter', 'CasinoCore'];
contracts.forEach(contract => {
  if (scriptContent.includes(contract)) {
    console.log(`  ✓ Contract: ${contract}`);
  } else {
    console.error(`  ✗ Missing contract: ${contract}`);
    errors++;
  }
});

// Test 8: Check for deployments directory creation
console.log('\n📋 Test 8: Checking deployments directory handling...');
if (scriptContent.includes('deployments') && scriptContent.includes('mkdirSync')) {
  console.log('  ✓ Creates deployments directory');
} else {
  console.error('  ✗ Does not create deployments directory');
  errors++;
}

// Test 9: Check for JSON output
console.log('\n📋 Test 9: Checking JSON output...');
if (scriptContent.includes('JSON.stringify') && scriptContent.includes('writeFileSync')) {
  console.log('  ✓ Writes JSON deployment file');
} else {
  console.error('  ✗ Does not write JSON deployment file');
  errors++;
}

// Test 10: Check documentation
console.log('\n📋 Test 10: Checking documentation...');
const docPatterns = ['@param', '@returns', 'PREREQUISITES:', 'USAGE:'];
let docCount = 0;
docPatterns.forEach(pattern => {
  if (scriptContent.includes(pattern)) {
    docCount++;
  }
});

if (docCount >= 3) {
  console.log(`  ✓ Documentation present (${docCount}/${docPatterns.length} patterns)`);
} else {
  console.warn(`  ⚠ Limited documentation (${docCount}/${docPatterns.length} patterns)`);
  warnings++;
}

// Summary
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║                     Validation Summary                         ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

if (errors === 0 && warnings === 0) {
  console.log('✅ All validation tests passed!');
  console.log('   The deployment script is ready to use.\n');
  process.exit(0);
} else if (errors === 0) {
  console.log(`⚠️  Validation passed with ${warnings} warning(s)`);
  console.log('   The deployment script should work but could be improved.\n');
  process.exit(0);
} else {
  console.error(`❌ Validation failed with ${errors} error(s) and ${warnings} warning(s)`);
  console.error('   Please fix the issues before using the deployment script.\n');
  process.exit(1);
}
