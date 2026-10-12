// Deploy KeccakHasher contract using Remix's compiler API
(async () => {
  try {
    // Access Remix's compiler via the remix module
    const { remix } = globalThis;
    
    // Try compiling using Remix's built-in Solidity compiler
    const compiler = await remix.compiler.compile(
      'contracts/KeccakHasher.sol',
      { optimize: true, runs: 200 }
    );
    console.log('Compilation result:', JSON.stringify(compiler, null, 2));
  } catch (err) {
    console.error('Script error:', err.message || err);
  }
})();
