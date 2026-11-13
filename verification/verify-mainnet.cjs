#!/usr/bin/env node
/*
 * verify-mainnet.cjs — Submit Polygon mainnet contract verifications to the
 * Etherscan V2 API (chainid 137 = Polygon, served by PolygonScan).
 *
 * One-purpose script for Matrix Hub task 127: verify CasinoCore, CasinoReserve,
 * LiquidityRouter and RNGEngine using the exact Standard-Json-Inputs and
 * constructor arguments proven byte-identical to the deployed contracts
 * (see bot-core/security/polygonscan-submission-pack/).
 *
 * Usage:
 *   node verification/verify-mainnet.cjs <CasinoCore|CasinoReserve|LiquidityRouter|RNGEngine|all> [--dry-run]
 *
 * The API key is read from the POLYGONSCAN_API_KEY environment variable
 * (a GitHub Actions secret in CI). It is NEVER printed, in whole or in part.
 *
 * Docs evidence (checked 2026-11-12 against docs.etherscan.io):
 *  - Endpoint: POST https://api.etherscan.io/v2/api, apikey as query param,
 *    module=contract, action=verifysourcecode, codeformat=solidity-standard-json-input.
 *    (docs.etherscan.io/api-reference/endpoint/verifysourcecode)
 *  - licenseType: 3 = MIT. Etherscan's official license list
 *    (etherscan.io/contract-license-types) numbers the schemes in order:
 *    1 No License, 2 Unlicense, 3 MIT, 4 GPLv2, ... The V2 verify guide
 *    states the same: "licenseType ... such as `3` for MIT".
 *  - Constructor arguments spelling: the CURRENT V2 endpoint reference spells
 *    the field `constructorArguments` (correct spelling), while Etherscan's
 *    long-standing sample-calls page and production tooling (foundry
 *    block-explorers, ethers-rs, etherscan-go) use the legacy misspelling
 *    `constructorArguements`, documented as required for Etherscan
 *    compatibility. To be safe against either server behaviour, this script
 *    sends BOTH spellings with the identical value.
 *  - With solidity-standard-json-input, optimizationUsed / runs / evmVersion
 *    are NOT sent: the settings travel inside the JSON (per the V2 guide).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const API_BASE = 'https://api.etherscan.io/v2/api';
const CHAIN_ID = '137'; // Polygon mainnet
const COMPILER_VERSION = 'v0.8.34+commit.80d5c536';
const CODE_FORMAT = 'solidity-standard-json-input';
const LICENSE_TYPE_MIT = '3'; // MIT — see header docs evidence

const TARGETS = {
  CasinoCore: {
    address: '0x8a3dBD4BECcAAC89F818E7cB0246241c40938DcA',
    inputFile: 'standard-input-core-reserve.json',
    constructorArgs: '00000000000000000000000053307e1db6c5cb6773c9495ca140372016dfe266000000000000000000000000887ebc888a184e57fe8efa2b2e8e66c58f53de04000000000000000000000000a7a3f9d629b1a6942ef8434639cb1c33010f55d500000000000000000000000000db079bac7d62e04f5bed1b4c771b959935116f0000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000003635c9adc5dea000000000000000000000000000000000000000000000000000056bc75e2d631000000000000000000000000000009fb4bb44d8d962d695fc93b3dc15f1b2873910770000000000000000000000009fb4bb44d8d962d695fc93b3dc15f1b287391077',
  },
  CasinoReserve: {
    address: '0xA7A3F9D629B1a6942EF8434639Cb1c33010F55d5',
    inputFile: 'standard-input-core-reserve.json',
    constructorArgs: '00000000000000000000000053307e1db6c5cb6773c9495ca140372016dfe26600000000000000000000000000000000000000000000d3c21bcecceda10000000000000000000000000000000000000000000000000000000000000000000000',
  },
  LiquidityRouter: {
    address: '0x887eBC888a184E57Fe8EfA2B2E8E66C58f53De04',
    inputFile: 'standard-input-router-rng.json',
    constructorArgs: '00000000000000000000000053307e1db6c5cb6773c9495ca140372016dfe266000000000000000000000000a5e0829caced8ffdd4de3c43696c57f7d7a678ff',
  },
  RNGEngine: {
    address: '0x00DB079bAC7D62e04f5BEd1B4c771b959935116f',
    inputFile: 'standard-input-router-rng.json',
    constructorArgs: '000000000000000000000000ec0ed46f36576541c75739e915adbcb3de24bd77c3e2763c20013bc078418406c72a51aa6218554206fcb38e20c24f3dc7e097d30ffbbd0c1c18c0263dd778dadd1d64240d7bc338d95fec1cf0473928ca7eaf9e000000000000000000000000000000000000000000000000000000000003d0900000000000000000000000000000000000000000000000000000000000000003',
  },
};

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Resolve "<source-key>:<ContractName>" from the Standard-Json-Input's own
// source keys — the API expects exactly this format for standard-json-input.
function contractNameFor(inputJson, contractName) {
  const sources = (inputJson && inputJson.sources) || {};
  const keys = Object.keys(sources);
  const suffix = `/${contractName}.sol`;
  const key = keys.find((k) => k === `${contractName}.sol` || k.endsWith(suffix));
  if (!key) {
    throw new Error(
      `No source key ending in "${suffix}" found in the standard input (keys: ${keys.join(', ')})`
    );
  }
  return `${key}:${contractName}`;
}

function loadTarget(name) {
  const cfg = TARGETS[name];
  const filePath = path.join(__dirname, cfg.inputFile);
  const sourceCode = fs.readFileSync(filePath, 'utf8');
  const inputJson = JSON.parse(sourceCode);
  return {
    name,
    address: cfg.address,
    inputFile: cfg.inputFile,
    sourceCode,
    sourceBytes: Buffer.byteLength(sourceCode, 'utf8'),
    sourceSha256: crypto.createHash('sha256').update(sourceCode, 'utf8').digest('hex'),
    contractname: contractNameFor(inputJson, name),
    constructorArgs: cfg.constructorArgs,
  };
}

function buildVerifyBody(t, apiKeyForUrlOnly) {
  // apikey goes in the query string per the docs example; it is not a body field.
  void apiKeyForUrlOnly;
  const body = new URLSearchParams();
  body.set('module', 'contract');
  body.set('action', 'verifysourcecode');
  body.set('chainid', CHAIN_ID);
  body.set('contractaddress', t.address);
  body.set('sourceCode', t.sourceCode);
  body.set('codeformat', CODE_FORMAT);
  body.set('contractname', t.contractname);
  body.set('compilerversion', COMPILER_VERSION);
  // Both spellings, identical value — see header note on the docs discrepancy.
  body.set('constructorArguments', t.constructorArgs);
  body.set('constructorArguements', t.constructorArgs);
  body.set('licenseType', LICENSE_TYPE_MIT);
  return body;
}

function printDryRun(t) {
  console.log(`\n=== DRY RUN: ${t.name} ===`);
  console.log(`POST ${API_BASE}?chainid=${CHAIN_ID}&apikey=***`);
  console.log('Content-Type: application/x-www-form-urlencoded');
  console.log('module=contract');
  console.log('action=verifysourcecode');
  console.log(`chainid=${CHAIN_ID}`);
  console.log(`contractaddress=${t.address}`);
  console.log(
    `sourceCode=<standard-json-input from ${t.inputFile}: ${t.sourceBytes} bytes, sha256 ${t.sourceSha256}>`
  );
  console.log(`codeformat=${CODE_FORMAT}`);
  console.log(`contractname=${t.contractname}`);
  console.log(`compilerversion=${COMPILER_VERSION}`);
  console.log(`constructorArguments=${t.constructorArgs}`);
  console.log(`constructorArguements=${t.constructorArgs} (legacy misspelling, same value)`);
  console.log(`licenseType=${LICENSE_TYPE_MIT} (MIT)`);
  console.log('apikey=*** (in query string; value never printed)');
}

async function postVerify(t, apiKey) {
  const url = `${API_BASE}?chainid=${CHAIN_ID}&apikey=${apiKey}`;
  const res = await fetch(url, { method: 'POST', body: buildVerifyBody(t) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`verifysourcecode returned non-JSON (HTTP ${res.status}): ${text.slice(0, 500)}`);
  }
  return json;
}

async function checkStatus(guid, apiKey) {
  const url =
    `${API_BASE}?chainid=${CHAIN_ID}&module=contract&action=checkverifystatus` +
    `&guid=${encodeURIComponent(guid)}&apikey=${apiKey}`;
  const res = await fetch(url);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`checkverifystatus returned non-JSON (HTTP ${res.status}): ${text.slice(0, 500)}`);
  }
}

function isAlreadyVerified(json) {
  const s = `${json.message || ''} ${json.result || ''}`.toLowerCase();
  return s.includes('already verified');
}

async function verifyOne(t, apiKey) {
  console.log(`\n=== ${t.name} (${t.address}) ===`);
  console.log(`contractname=${t.contractname}  input=${t.inputFile} (${t.sourceBytes} bytes)`);
  const submit = await postVerify(t, apiKey);
  if (submit.status === '1' && submit.result) {
    console.log(`Submitted. GUID: ${submit.result}`);
  } else if (isAlreadyVerified(submit)) {
    console.log(`Already verified on PolygonScan — treating as success. API said: ${submit.result || submit.message}`);
    return { name: t.name, ok: true, detail: 'already verified' };
  } else {
    console.error(`Submission rejected. status=${submit.status} message=${submit.message} result=${submit.result}`);
    return { name: t.name, ok: false, detail: `submit rejected: ${submit.result || submit.message}` };
  }

  const guid = submit.result;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let last = '';
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const st = await checkStatus(guid, apiKey);
    const result = String(st.result || '');
    if (result !== last) {
      console.log(`  status: ${result}`);
      last = result;
    }
    if (/pass\s*-\s*verified/i.test(result)) {
      console.log(`${t.name}: Pass - Verified`);
      return { name: t.name, ok: true, detail: result };
    }
    if (/fail/i.test(result) || /unable/i.test(result)) {
      console.error(`${t.name}: FAILED — ${result}`);
      return { name: t.name, ok: false, detail: result };
    }
    // otherwise "Pending in queue" — keep polling
  }
  console.error(`${t.name}: timed out after ${POLL_TIMEOUT_MS / 1000}s waiting for a final status (last: ${last})`);
  return { name: t.name, ok: false, detail: `timeout, last status: ${last}` };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const targetArg = argv.find((a) => !a.startsWith('--')) || 'all';

  let names;
  if (targetArg === 'all') {
    names = Object.keys(TARGETS);
  } else if (Object.prototype.hasOwnProperty.call(TARGETS, targetArg)) {
    names = [targetArg];
  } else {
    console.error(`Unknown target "${targetArg}". Expected one of: all, ${Object.keys(TARGETS).join(', ')}`);
    process.exit(2);
  }

  const targets = names.map(loadTarget);

  if (dryRun) {
    console.log('DRY RUN — nothing will be sent. apikey shown as ***.');
    for (const t of targets) printDryRun(t);
    console.log('\nDry run complete.');
    return;
  }

  const apiKey = process.env.POLYGONSCAN_API_KEY;
  if (!apiKey) {
    console.error('ERROR: POLYGONSCAN_API_KEY is not set in the environment. Aborting — no request was sent.');
    process.exit(2);
  }

  const results = [];
  for (const t of targets) {
    try {
      results.push(await verifyOne(t, apiKey));
    } catch (err) {
      console.error(`${t.name}: ERROR — ${err.message}`);
      results.push({ name: t.name, ok: false, detail: err.message });
    }
  }

  console.log('\n=== Summary ===');
  let allOk = true;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
    if (!r.ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
