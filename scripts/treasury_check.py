#!/usr/bin/env python3
"""
Treasury check for Matrix Hub MTX (MatrixHubCoin).

Reads the six on-chain values for the VERIFIED MTX contract and the
QuickSwap V2 pair, from two independent sources, and prints a one-line
verdict.  Stdlib only (urllib, json, argparse, os, sys, datetime).

Ground truths (verified, do NOT change without a new on-chain check):
  Real MTX (MatrixHubCoin): 0x53307e1db6c5cb6773c9495ca140372016dfe266
  Chain: Polygon 137
  Deployer: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077
  Fake / phishing token (BLOCKLIST ONLY, never a valid MTX address):
      0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a
  SafeProxy multisig (NOT MTX): 0x7Ee41D8A25641000661B1EF5E6AE8A00400466B0
  QuickSwap V2 Factory: 0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32
  WMATIC: 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270
  Casino is NOT live. MTX is a utility token, not an investment,
  with no guaranteed value.

Sources:
  Source 1 (primary): JSON-RPC endpoint (--rpc, default
      https://polygon-bor-rpc.publicnode.com).  eth_call / eth_getBalance /
      eth_blockNumber / eth_getBlockByNumber.  The workflow tries a short
      list of public RPCs in order; endpoints that are dead from a given
      runner (401/403, DNS failure, key-required) are skipped, not
      retried forever.  (Former defaults polygon-rpc.com and
      polygon.llamarpc.com are dead — 401 tenant-disabled / DNS failure,
      verified in Actions run 42764168559, 2026-11-10; Ankr needs its own
      API key.)
  Source 2: Etherscan API V2 proxy (module=proxy, action=eth_call /
      eth_getBalance / eth_blockNumber, chainid=137).  Only used when
      the API key is present in the environment (default env var
      POLYGONSCAN_API_KEY, overridable with --api-key-env).  The key
      is NEVER printed, logged, or written to any output file.
      (Former endpoint api.polygonscan.com/api is dead — it now serves
      the Etherscan API docs landing page, verified 2026-11-10.)

Function selectors are NOT hard-coded guesses: they are computed at
runtime from the function signatures with a pure-Python Keccak-256
(original Keccak padding, NOT SHA3-256).  Two well-known selectors
are cross-checked as a self-test -- totalSupply() must be 0x18160ddd
and owner() must be 0x8da5cb5b -- and any mismatch is a loud failure.
When the PolygonScan API key is available, the contract ABI is also
fetched (module=contract, action=getabi) and each function name must
be present in it; a missing function is a loud failure.

Exit codes:
  0  All reads succeeded AND both sources agree on every value.
  2  Partial: reads succeeded on source 1 but two-source agreement
     was NOT confirmed (second source unavailable / skipped).  The
     verdict is printed with a clear warning; do NOT treat it as
     certified.
  1  Any read failure, source disagreement, ABI/selector mismatch,
     or unreachable RPC (including HTTP 401/403).  Values are printed
     as UNKNOWN -- NEVER config defaults (100M / 1000).

Usage:
  python3 treasury_check.py [--api-key-env POLYGONSCAN_API_KEY]
                            [--rpc URL] [--out FILE] [--dry-run]
"""

import argparse
import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

MTX = "0x53307e1db6c5cb6773c9495ca140372016dfe266"
CHAIN_ID = 137
DEPLOYER = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077"
FAKE_TOKEN = "0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a"  # BLOCKLIST ONLY
SAFEPROXY = "0x7Ee41D8A25641000661B1EF5E6AE8A00400466B0"  # NOT MTX
FACTORY = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32"
WMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
DEFAULT_RPC = "https://polygon-bor-rpc.publicnode.com"
POLYGONSCAN_API = "https://api.etherscan.io/v2/api"  # Etherscan API V2 (chainid=137 param added in _get); api.polygonscan.com/api is DEAD (serves docs landing page, verified 2026-11-10)

# Function signatures read from the contract. Selectors are computed
# from these at runtime via keccak256 (see selector()).
SIGNATURES = {
    "mintingPaused": "mintingPaused()",
    "maticToMtxRate": "maticToMtxRate()",
    "MAX_SUPPLY": "MAX_SUPPLY()",
    "totalSupply": "totalSupply()",
    "owner": "owner()",
    "getPair": "getPair(address,address)",
}

# Self-test: two selectors whose values are independently well known.
# If keccak256 disagrees with these, the implementation is wrong and
# the script must fail rather than call with a wrong selector.
KNOWN_SELECTORS = {
    "totalSupply()": "18160ddd",
    "owner()": "8da5cb5b",
}

MASK64 = (1 << 64) - 1


# ---------------------------------------------------------------------------
# Pure-Python Keccak-256 (original Keccak, pad10*1 with domain 0x01).
# NOT SHA3-256 (which uses domain 0x06).  Verified against the known
# vectors: keccak256(b"") =
#   c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
# and keccak256(b"totalSupply()")[:4] == 0x18160ddd.
# ---------------------------------------------------------------------------

def _rol(x, n):
    n %= 64
    if n == 0:
        return x & MASK64
    return ((x << n) | (x >> (64 - n))) & MASK64


_RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A,
    0x8000000080008000, 0x000000000000808B, 0x0000000080000001,
    0x8000000080008081, 0x8000000000008009, 0x000000000000008A,
    0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
    0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
    0x000000000000800A, 0x800000008000000A, 0x8000000080008081,
    0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
]

_R = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14],
]


def _keccak_f1600(state):
    """Keccak-f[1600] permutation, in place. state: list of 25 ints."""
    for rnd in range(24):
        # Theta
        c = [state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20]
             for x in range(5)]
        d = [c[(x + 4) % 5] ^ _rol(c[(x + 1) % 5], 1) for x in range(5)]
        state = [state[x + 5 * y] ^ d[x] for y in range(5) for x in range(5)]
        # Rho + Pi
        b = [0] * 25
        for x in range(5):
            for y in range(5):
                b[y + 5 * ((2 * x + 3 * y) % 5)] = _rol(state[x + 5 * y], _R[x][y])
        # Chi
        for x in range(5):
            for y in range(5):
                state[x + 5 * y] = (
                    b[x + 5 * y]
                    ^ ((~b[(x + 1) % 5 + 5 * y]) & b[(x + 2) % 5 + 5 * y])
                ) & MASK64
        # Iota
        state[0] ^= _RC[rnd]
    return state


def keccak256(data: bytes) -> bytes:
    """Original Keccak-256 digest of data."""
    rate = 136  # bytes, for 256-bit output
    padded = bytearray(data)
    padded.append(0x01)
    while len(padded) % rate != rate - 1:
        padded.append(0x00)
    padded.append(0x80)
    state = [0] * 25
    for off in range(0, len(padded), rate):
        block = padded[off:off + rate]
        for i in range(rate // 8):
            lane = int.from_bytes(block[i * 8:(i + 1) * 8], "little")
            state[i] ^= lane
        state = _keccak_f1600(state)
    out = bytearray()
    for i in range(4):  # 32 bytes
        out += state[i].to_bytes(8, "little")
    return bytes(out)


def selector(signature: str) -> str:
    """4-byte function selector as 8 hex chars, computed via Keccak-256."""
    return keccak256(signature.encode("ascii")).hex()[:8]


def verify_selectors():
    """Self-test keccak256 against known vectors; fail loudly on mismatch."""
    if keccak256(b"").hex() != (
        "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    ):
        raise RuntimeError("keccak256 self-test FAILED on empty input")
    for sig, expected in KNOWN_SELECTORS.items():
        got = selector(sig)
        if got != expected:
            raise RuntimeError(
                "keccak256 self-test FAILED: %s -> 0x%s, expected 0x%s"
                % (sig, got, expected)
            )


# ---------------------------------------------------------------------------
# Encoding / decoding helpers
# ---------------------------------------------------------------------------

def encode_address(addr: str) -> str:
    return addr.lower().replace("0x", "").rjust(64, "0")


def decode_uint256(hexdata: str) -> int:
    h = hexdata[2:] if hexdata.startswith("0x") else hexdata
    if len(h) < 64:
        raise ValueError("short uint256 result: %r" % hexdata)
    return int(h[:64], 16)


def decode_bool(hexdata: str) -> bool:
    return decode_uint256(hexdata) != 0


def decode_address(hexdata: str) -> str:
    h = hexdata[2:] if hexdata.startswith("0x") else hexdata
    if len(h) < 64:
        raise ValueError("short address result: %r" % hexdata)
    return "0x" + h[24:64].lower()


def decode_pair(hexdata: str) -> str:
    # getPair returns a single address (32-byte word).
    return decode_address(hexdata)


def hex_to_int(value):
    if isinstance(value, int):
        return value
    return int(value, 16)


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


def fmt_time(ts):
    if ts is None:
        return "UNKNOWN"
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


# ---------------------------------------------------------------------------
# HTTP helpers -- fail loudly, never swallow an HTTP error.
#
# Transient failures are RETRYABLE (up to MAX_ATTEMPTS with exponential
# backoff): HTTP 429 / 5xx, dropped connections / DNS hiccups, empty or
# non-JSON response bodies, and Etherscan "rate limit" text returned as
# a 200 result.  Permanent failures are NOT retried: HTTP 401/403
# (tenant disabled / Cloudflare ban / key-required endpoint) and
# JSON-RPC "error" objects (e.g. Ankr -32000 Unauthorized).
# Run 42764168559 (2026-11-10) showed why this matters: the Etherscan
# free plan allows 3 calls/sec and the script fired its calls with no
# pacing, so proxy eth_call returned "Max calls per sec rate limit
# reached (3/sec)" as the result and getabi returned an empty body.
# ---------------------------------------------------------------------------

MAX_ATTEMPTS = 3
RETRY_BASE_DELAY = 1.0  # seconds; exponential backoff: 1s, 2s
# Etherscan free plan: 3 calls/sec. Pace Source 2 calls at 2.5/sec.
POLYGONSCAN_MIN_INTERVAL = 0.4  # seconds between Etherscan API calls


class RetryableError(RuntimeError):
    """Transient failure: safe to retry (rate limit, empty response,
    HTTP 429/5xx, dropped connection)."""


def call_with_retries(fn, what):
    """Call fn(), retrying RetryableError up to MAX_ATTEMPTS with
    exponential backoff. Returns fn()'s value or raises the last
    RetryableError. Non-retryable errors propagate immediately."""
    last_exc = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            return fn()
        except RetryableError as exc:
            last_exc = exc
            if attempt < MAX_ATTEMPTS - 1:
                time.sleep(RETRY_BASE_DELAY * (2 ** attempt))
    raise last_exc


def _is_retryable_http(code):
    return code == 429 or 500 <= code < 600


def _sanitize_url(url):
    """Strip the apikey query parameter from a URL so error messages
    never leak the key. Etherscan calls carry the key in the query
    string, and these URLs appear in error messages that are printed
    to stderr, written to the evidence packet, and copied into the
    GitHub job summary — all of which would otherwise expose it."""
    if "apikey=" not in url:
        return url
    parsed = urllib.parse.urlparse(url)
    qs = [(k, v) for k, v in
          urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
          if k.lower() != "apikey"]
    return urllib.parse.urlunparse(
        parsed._replace(query=urllib.parse.urlencode(qs)))


def _read_body(exc):
    try:
        return exc.read().decode("utf-8", "replace")[:500]
    except Exception:
        return ""


def http_post_json(url, payload, timeout=30):
    """Single POST attempt. Raises RetryableError for transient
    failures, RuntimeError for permanent ones (HTTP 401/403 etc.)."""
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = _read_body(exc)
        if _is_retryable_http(exc.code):
            raise RetryableError(
                "HTTP %s from %s: %s" % (exc.code, _sanitize_url(url), body)
            ) from exc
        raise RuntimeError(
            "HTTP %s from %s: %s" % (exc.code, _sanitize_url(url), body)
        ) from exc
    except urllib.error.URLError as exc:
        raise RetryableError(
            "unreachable %s: %s" % (_sanitize_url(url), exc.reason)) from exc
    try:
        return json.loads(raw)
    except ValueError as exc:
        raise RetryableError(
            "empty or non-JSON response from %s: %r"
            % (_sanitize_url(url), raw[:200])
        ) from exc


def http_get_json(url, timeout=30):
    """Single GET attempt. Raises RetryableError for transient
    failures, RuntimeError for permanent ones."""
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = _read_body(exc)
        if _is_retryable_http(exc.code):
            raise RetryableError(
                "HTTP %s from %s: %s" % (exc.code, _sanitize_url(url), body)
            ) from exc
        raise RuntimeError(
            "HTTP %s from %s: %s" % (exc.code, _sanitize_url(url), body)
        ) from exc
    except urllib.error.URLError as exc:
        raise RetryableError(
            "unreachable %s: %s" % (_sanitize_url(url), exc.reason)) from exc
    try:
        return json.loads(raw)
    except ValueError as exc:
        raise RetryableError(
            "empty or non-JSON response from %s: %r"
            % (_sanitize_url(url), raw[:200])
        ) from exc


# ---------------------------------------------------------------------------
# Source 1: JSON-RPC
# ---------------------------------------------------------------------------

class RpcSource:
    name = "rpc"

    def __init__(self, url):
        self.url = url
        self._id = 0

    def call(self, method, params):
        def _once():
            self._id += 1
            payload = {"jsonrpc": "2.0", "id": self._id, "method": method,
                       "params": params}
            resp = http_post_json(self.url, payload)
            if "error" in resp:
                # A JSON-RPC error object is a real answer (e.g. Ankr
                # -32000 Unauthorized): permanent, do not retry.
                raise RuntimeError("RPC %s error: %s" % (method, resp["error"]))
            if "result" not in resp:
                raise RuntimeError("RPC %s: no result in %r" % (method, resp))
            return resp["result"]

        return call_with_retries(_once, "RPC %s" % method)

    def eth_call(self, to, data):
        return self.call("eth_call", [{"to": to, "data": data}, "latest"])

    def eth_get_balance(self, address):
        return self.call("eth_getBalance", [address, "latest"])

    def block_number(self):
        return hex_to_int(self.call("eth_blockNumber", []))

    def block_timestamp(self, block_number):
        block = self.call(
            "eth_getBlockByNumber", [hex(block_number), False])
        if not block or "timestamp" not in block:
            raise RuntimeError("RPC: block %d has no timestamp" % block_number)
        return hex_to_int(block["timestamp"])


# ---------------------------------------------------------------------------
# Source 2: Etherscan API V2 proxy (requires an API key from the env).
# The key is passed only as a query parameter to api.etherscan.io/v2/api
# and is NEVER printed, logged, or written to output.
# ---------------------------------------------------------------------------

class PolygonscanSource:
    name = "polygonscan"

    def __init__(self, api_key):
        self.api_key = api_key
        self._next_allowed = 0.0  # monotonic timestamp for call pacing

    def _get(self, params):
        params = dict(params)
        params["chainid"] = "137"  # Etherscan API V2: Polygon
        params["apikey"] = self.api_key
        url = POLYGONSCAN_API + "?" + urllib.parse.urlencode(params)

        def _once():
            # Pace calls: the free plan allows 3 calls/sec. Without
            # pacing, run 42764168559 got "Max calls per sec rate limit
            # reached (3/sec)" returned as the result.
            now = time.monotonic()
            wait = self._next_allowed - now
            if wait > 0:
                time.sleep(wait)
            self._next_allowed = max(now, self._next_allowed) + POLYGONSCAN_MIN_INTERVAL
            resp = http_get_json(url)
            if str(resp.get("status")) == "0":
                result = resp.get("result")
                if isinstance(result, str) and "rate limit" in result.lower():
                    # Etherscan returns the rate limit as a 200 result
                    # string: retryable with backoff, not a hard failure.
                    raise RetryableError(
                        "Etherscan rate limit: %s" % result)
                raise RuntimeError(
                    "PolygonScan API error: %s"
                    % (resp.get("message") or result or resp,)
                )
            if "result" not in resp:
                raise RuntimeError(
                    "PolygonScan API error: %s"
                    % (resp.get("message") or resp,)
                )
            return resp["result"]

        return call_with_retries(_once, "PolygonScan API")

    def eth_call(self, to, data):
        return self._get({
            "module": "proxy", "action": "eth_call",
            "to": to, "data": data, "tag": "latest",
        })

    def eth_get_balance(self, address):
        return self._get({
            "module": "proxy", "action": "eth_getBalance",
            "address": address, "tag": "latest",
        })

    def block_number(self):
        return hex_to_int(self._get({
            "module": "proxy", "action": "eth_blockNumber",
        }))

    def block_timestamp(self, block_number):
        block = self._get({
            "module": "proxy", "action": "eth_getBlockByNumber",
            "tag": hex(block_number), "boolean": "false",
        })
        if not block or "timestamp" not in block:
            raise RuntimeError(
                "PolygonScan: block %d has no timestamp" % block_number)
        return hex_to_int(block["timestamp"])

    def get_abi(self, address):
        abi_json = self._get({
            "module": "contract", "action": "getabi", "address": address,
        })
        return json.loads(abi_json)


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

def read_all(source, selectors):
    """Read the six values + pool pair from one source. Returns dict."""
    out = {}
    out["mintingPaused"] = decode_bool(
        source.eth_call(MTX, "0x" + selectors["mintingPaused"]))
    out["maticToMtxRate"] = decode_uint256(
        source.eth_call(MTX, "0x" + selectors["maticToMtxRate"]))
    out["MAX_SUPPLY_raw"] = decode_uint256(
        source.eth_call(MTX, "0x" + selectors["MAX_SUPPLY"]))
    out["totalSupply_raw"] = decode_uint256(
        source.eth_call(MTX, "0x" + selectors["totalSupply"]))
    out["owner"] = decode_address(
        source.eth_call(MTX, "0x" + selectors["owner"]))
    out["pol_balance_wei"] = hex_to_int(source.eth_get_balance(MTX))
    pair_data = "0x" + selectors["getPair"] + encode_address(MTX) + encode_address(WMATIC)
    out["pair"] = decode_pair(source.eth_call(FACTORY, pair_data))
    out["block"] = source.block_number()
    out["timestamp"] = source.block_timestamp(out["block"])
    return out


def verdict_line(values):
    if values is None:
        return (
            "Mint: UNKNOWN | Rate: UNKNOWN | Max supply: UNKNOWN | "
            "Minted so far: UNKNOWN | Pool: UNKNOWN | Owner: UNKNOWN | "
            "Block UNKNOWN @ UNKNOWN"
        )
    mint = "PAUSED" if values["mintingPaused"] else "LIVE"
    max_supply = values["MAX_SUPPLY_raw"] // 10 ** 18
    minted = values["totalSupply_raw"] // 10 ** 18
    pool = (
        "YES %s" % values["pair"]
        if values["pair"].lower() != ZERO_ADDRESS else "NO"
    )
    return (
        "Mint: %s | Rate: 1 POL = %d MTX | Max supply: %d | "
        "Minted so far: %d | Pool: %s | Owner: %s | Block %d @ %s"
        % (mint, values["maticToMtxRate"], max_supply, minted, pool,
           values["owner"], values["block"], fmt_time(values["timestamp"]))
    )


def print_table(values, label):
    print("\n[%s]" % label)
    if values is None:
        print("  all values: UNKNOWN")
        return
    print("  mintingPaused : %s" % values["mintingPaused"])
    print("  maticToMtxRate: %d  (1 POL = %d MTX)"
          % (values["maticToMtxRate"], values["maticToMtxRate"]))
    print("  MAX_SUPPLY    : %d MTX (raw %d)"
          % (values["MAX_SUPPLY_raw"] // 10 ** 18, values["MAX_SUPPLY_raw"]))
    print("  totalSupply   : %d MTX (raw %d)"
          % (values["totalSupply_raw"] // 10 ** 18, values["totalSupply_raw"]))
    print("  owner         : %s" % values["owner"])
    print("  POL balance   : %d wei (%.6f POL)"
          % (values["pol_balance_wei"], values["pol_balance_wei"] / 10 ** 18))
    print("  QuickSwap pair: %s" % values["pair"])
    print("  block         : %d @ %s"
          % (values["block"], fmt_time(values["timestamp"])))


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=(
            "Treasury check for Matrix Hub MTX "
            "(0x53307e1db6c5cb6773c9495ca140372016dfe266, Polygon 137). "
            "Reads mintingPaused, maticToMtxRate, MAX_SUPPLY, totalSupply, "
            "owner, contract POL balance and the QuickSwap pair from two "
            "independent sources. Exits 0 only if both sources agree; "
            "1 on any failure/disagreement; 2 if the second source was "
            "unavailable so two-source agreement was NOT confirmed. "
            "Never prints an API key and never falls back to config "
            "defaults (100M / 1000)."
        )
    )
    parser.add_argument("--api-key-env", default="POLYGONSCAN_API_KEY",
                        help="name of the environment variable holding the "
                             "PolygonScan API key (default: "
                             "POLYGONSCAN_API_KEY). The key is read from "
                             "the environment only and never printed.")
    parser.add_argument("--rpc", default=DEFAULT_RPC,
                        help="JSON-RPC endpoint for source 1 "
                             "(default: %(default)s)")
    parser.add_argument("--out", default=None,
                        help="optional path to write the evidence packet "
                             "as JSON")
    parser.add_argument("--dry-run", action="store_true",
                        help="print the computed selectors, the calls that "
                             "would be made, and the verdict format with "
                             "UNKNOWN values; make no network calls; exit 0")
    args = parser.parse_args(argv)

    # Keccak self-test first: a wrong selector must fail before any call.
    try:
        verify_selectors()
    except RuntimeError as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 1

    selectors = {name: selector(sig) for name, sig in SIGNATURES.items()}

    if args.dry_run:
        print("DRY RUN -- no network calls made.")
        print("Contract: %s (Polygon %d)" % (MTX, CHAIN_ID))
        print("Computed selectors (keccak256 of signature, first 4 bytes):")
        for name, sig in SIGNATURES.items():
            print("  %-15s %s  -> 0x%s" % (name, sig, selectors[name]))
        print("Calls that would be made (source 1: %s):" % args.rpc)
        for name in ("mintingPaused", "maticToMtxRate", "MAX_SUPPLY",
                     "totalSupply", "owner"):
            print("  eth_call to=%s data=0x%s" % (MTX, selectors[name]))
        print("  eth_getBalance %s" % MTX)
        print("  eth_call to=%s (QuickSwap factory) data=0x%s<MTX><WMATIC>"
              % (FACTORY, selectors["getPair"]))
        print("  eth_blockNumber + eth_getBlockByNumber (timestamp)")
        print("Source 2 (PolygonScan proxy API) would be used only if the "
              "API key is present in the environment.")
        print("\nVerdict format:")
        print("  " + verdict_line(None))
        print("\nNOTE: verdict values are UNKNOWN in a dry run. "
              "Config defaults (100M / 1000) are never substituted.")
        return 0

    print("Treasury check -- MTX %s (Polygon %d)" % (MTX, CHAIN_ID))
    print("Checked at (UTC): %s" % utc_now().strftime("%Y-%m-%dT%H:%M:%SZ"))

    api_key = os.environ.get(args.api_key_env)
    second_available = bool(api_key)
    if not second_available:
        print("WARNING: no API key in env var %s -- PolygonScan second "
              "source will be SKIPPED. Two-source agreement will NOT be "
              "confirmed." % args.api_key_env)

    errors = []

    # --- Source 1: RPC ---------------------------------------------------
    rpc = RpcSource(args.rpc)
    values1 = None
    try:
        values1 = read_all(rpc, selectors)
        print_table(values1, "Source 1: RPC %s" % args.rpc)
    except Exception as exc:  # noqa: BLE001 - fail loudly, report, exit 1
        errors.append("source 1 (RPC %s): %s" % (args.rpc, exc))
        print("ERROR source 1 (RPC %s): %s" % (args.rpc, exc), file=sys.stderr)

    # --- Source 2: PolygonScan (only with a key) -------------------------
    values2 = None
    if second_available:
        ps = PolygonscanSource(api_key)
        try:
            # ABI check: every function we call must be in the ABI.
            abi = ps.get_abi(MTX)
            abi_names = {f.get("name") for f in abi if isinstance(f, dict)}
            for name in ("mintingPaused", "maticToMtxRate", "MAX_SUPPLY",
                         "totalSupply", "owner"):
                if name not in abi_names:
                    raise RuntimeError(
                        "ABI check FAILED: %s not in contract ABI" % name)
            print("ABI check: mintingPaused, maticToMtxRate, MAX_SUPPLY, "
                  "totalSupply, owner all present in PolygonScan ABI.")
            values2 = read_all(ps, selectors)
            print_table(values2, "Source 2: PolygonScan proxy API")
        except Exception as exc:  # noqa: BLE001
            errors.append("source 2 (PolygonScan): %s" % exc)
            print("ERROR source 2 (PolygonScan): %s" % exc, file=sys.stderr)
    else:
        print("Source 2: SKIPPED (no API key in environment).")

    # --- Verdict ----------------------------------------------------------
    print("\nVerdict:")
    print("  " + verdict_line(values1))
    if values1 is not None:
        print("  Note: a QuickSwap pair of %s means NO pool; reserves "
              "must still be checked separately before any liquidity "
              "claim." % ZERO_ADDRESS)

    packet = {
        "contract": MTX,
        "chain_id": CHAIN_ID,
        "deployer": DEPLOYER,
        "checked_at_utc": utc_now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source1_rpc": args.rpc,
        "source1": values1,
        "source2_polygonscan": values2,
        "two_source_available": second_available,
        "two_source_agree": None,
        "verdict": verdict_line(values1),
        "errors": errors,
    }

    if values1 is None:
        print("\nRESULT: FAILED -- source 1 read failed. All values "
              "UNKNOWN. Config defaults (100M / 1000) were NOT used.",
              file=sys.stderr)
        for err in errors:
            print("  - %s" % err, file=sys.stderr)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as fh:
                json.dump(packet, fh, indent=2)
        return 1

    if not second_available:
        print("\nRESULT: PARTIAL -- source 1 succeeded, but two-source "
              "agreement was NOT confirmed (PolygonScan key absent). "
              "Do NOT treat these numbers as certified.")
        packet["two_source_agree"] = False
        if args.out:
            with open(args.out, "w", encoding="utf-8") as fh:
                json.dump(packet, fh, indent=2)
        return 2

    if values2 is None:
        print("\nRESULT: FAILED -- source 2 read failed. Values are "
              "UNKNOWN for certification purposes.", file=sys.stderr)
        for err in errors:
            print("  - %s" % err, file=sys.stderr)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as fh:
                json.dump(packet, fh, indent=2)
        return 1

    disagree = [k for k in values1
                if k in values2 and values1[k] != values2[k]]
    # Block numbers may legitimately differ by a few blocks between
    # sources; compare values, not the block itself.
    disagree = [k for k in disagree if k not in ("block", "timestamp")]
    if disagree:
        print("\nRESULT: FAILED -- sources DISAGREE on: %s. All affected "
              "values are UNKNOWN. Config defaults were NOT used."
              % ", ".join(disagree), file=sys.stderr)
        packet["two_source_agree"] = False
        if args.out:
            with open(args.out, "w", encoding="utf-8") as fh:
                json.dump(packet, fh, indent=2)
        return 1

    print("\nRESULT: OK -- both sources agree on all six values + pool "
          "pair. Two-source agreement CONFIRMED.")
    packet["two_source_agree"] = True
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(packet, fh, indent=2)
        print("Evidence packet written to %s" % args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
