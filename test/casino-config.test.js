import { expect } from 'chai';
import {
  Casino,
  DEPLOYED_CASINO_CONTRACTS,
  isValidAddress,
  isPlaceholder,
  createContractInfo,
  getContractAddress
} from '../src/config/casino.ts';
import { MTX } from '../src/config/mtx.ts';

describe('Casino Configuration and Deployment Status', () => {
  it('should use the selected Polygon MTX token by default', () => {
    expect(MTX.address).to.equal(
      '0x53307e1db6c5cb6773c9495ca140372016dfe266'
    );
  });

  it('should leave casino module addresses unavailable until valid deployments exist', () => {
    expect(Casino.chainId).to.equal(137);
    expect(Casino.chainName).to.equal('Polygon');
    expect(Casino.contracts.casinoCore.isDeployed).to.equal(false);
    expect(Casino.contracts.casinoReserve.isDeployed).to.equal(false);
    expect(Casino.contracts.liquidityRouter.isDeployed).to.equal(false);
    expect(Casino.contracts.rngEngine.isDeployed).to.equal(false);
    expect(Casino.isFullyDeployed).to.equal(false);
    expect(Casino.owner).to.equal('0x9fb4bb44d8d962d695fc93b3dc15f1b287391077');
    expect(Casino.governance).to.equal('0x9fb4bb44d8d962d695fc93b3dc15f1b287391077');
  });

  it('should show placeholders for unvalidated casino contracts', () => {
    expect(Casino.contracts.casinoCore.displayAddress).to.equal('Coming Soon');
    expect(Casino.contracts.casinoCore.blockExplorerUrl).to.equal(undefined);
    expect(Casino.contracts.casinoReserve.displayAddress).to.equal('Coming Soon');
    expect(Casino.contracts.casinoReserve.blockExplorerUrl).to.equal(undefined);
    expect(Casino.contracts.liquidityRouter.displayAddress).to.equal('Coming Soon');
    expect(Casino.contracts.liquidityRouter.blockExplorerUrl).to.equal(undefined);
    expect(Casino.contracts.rngEngine.blockExplorerUrl).to.equal(undefined);
  });

  it('should validate 40-character EVM addresses and 64-character deployed hashes', () => {
    expect(isValidAddress('0x9fb4bb44d8d962d695fc93b3dc15f1b287391077')).to.equal(true);
    expect(isValidAddress('0x2fbee7a063dafc8adadfaa1c351796407454a1e0')).to.equal(true);
    expect(isValidAddress('0x206bbb10e54e2b937b90611b31d1954ebaca9e4acf9b62cbb38a9591495aa5c9')).to.equal(true);
    expect(isValidAddress('0x123')).to.equal(false);
    expect(isValidAddress('')).to.equal(false);
    expect(isValidAddress(null)).to.equal(false);
    expect(isValidAddress(undefined)).to.equal(false);
  });

  it('should identify zero addresses and placeholder strings', () => {
    expect(isPlaceholder('0x0000000000000000000000000000000000000000')).to.equal(true);
    expect(isPlaceholder('Coming Soon')).to.equal(true);
    expect(isPlaceholder(null)).to.equal(true);
    expect(isPlaceholder(undefined)).to.equal(true);
    expect(isPlaceholder(DEPLOYED_CASINO_CONTRACTS.casinoCore)).to.equal(true);
    expect(isPlaceholder('0x9fb4bb44d8d962d695fc93b3dc15f1b287391077')).to.equal(false);
  });

  it('should create contract info with displayAddress and isDeployed flags', () => {
    const validAddress = '0x1111111111111111111111111111111111111111';
    const deployedInfo = createContractInfo(validAddress);
    expect(deployedInfo.isDeployed).to.equal(true);
    expect(deployedInfo.displayAddress).to.equal(validAddress);
    expect(deployedInfo.blockExplorerUrl).to.include(validAddress);

    const placeholderInfo = createContractInfo('0x0000000000000000000000000000000000000000');
    expect(placeholderInfo.isDeployed).to.equal(false);
    expect(placeholderInfo.displayAddress).to.equal('Coming Soon');
    expect(placeholderInfo.blockExplorerUrl).to.equal(undefined);
  });

  it('should prefer environment variables when provided, or fallback to default', () => {
    const customAddress = '0x1111111111111111111111111111111111111111';
    expect(getContractAddress(customAddress, DEPLOYED_CASINO_CONTRACTS.casinoCore)).to.equal(
      customAddress
    );
    expect(getContractAddress(undefined, DEPLOYED_CASINO_CONTRACTS.casinoCore)).to.equal(
      DEPLOYED_CASINO_CONTRACTS.casinoCore
    );
    expect(getContractAddress('', DEPLOYED_CASINO_CONTRACTS.casinoCore)).to.equal(
      DEPLOYED_CASINO_CONTRACTS.casinoCore
    );
  });
});
