import { expect } from 'chai';
import {
  Casino,
  DEPLOYED_CASINO_CONTRACTS,
  isValidAddress,
  isPlaceholder,
  createContractInfo,
  getContractAddress
} from '../src/config/casino.ts';

describe('Casino Configuration and Deployment Status', () => {
  it('should expose the expected Polygon mainnet deployed contract addresses by default', () => {
    expect(Casino.contracts.casinoCore.address).to.equal(
      '0x206bbb10e54e2b937b90611b31d1954ebaca9e4acf9b62cbb38a9591495aa5c9'
    );
    expect(Casino.contracts.casinoReserve.address).to.equal(
      '0xc35da432aa4ab30790f491bc4ab87b044cffae940df04966438e216a489cef01'
    );
    expect(Casino.contracts.liquidityRouter.address).to.equal(
      '0xf7aebcb5df8aa402ad96ef88deb64a84df606545e641da7863e05e748af21ef1'
    );
    expect(Casino.contracts.rngEngine.address).to.equal(
      '0x4915ac24ca2933261d1b6f0f0679c0f5fb99cf398963c3b5a88e7825d922326f'
    );
  });

  it('should reflect deployed status on Polygon mainnet (Chain ID 137)', () => {
    expect(Casino.chainId).to.equal(137);
    expect(Casino.chainName).to.equal('Polygon');
    expect(Casino.contracts.casinoCore.isDeployed).to.equal(true);
    expect(Casino.contracts.casinoReserve.isDeployed).to.equal(true);
    expect(Casino.contracts.liquidityRouter.isDeployed).to.equal(true);
    expect(Casino.contracts.rngEngine.isDeployed).to.equal(true);
    expect(Casino.isFullyDeployed).to.equal(true);
    expect(Casino.owner).to.equal('0x9fb4bb44d8d962d695fc93b3dc15f1b287391077');
    expect(Casino.governance).to.equal('0x9fb4bb44d8d962d695fc93b3dc15f1b287391077');
  });

  it('should provide block explorer URLs and display addresses for deployed contracts', () => {
    expect(Casino.contracts.casinoCore.displayAddress).to.equal(
      DEPLOYED_CASINO_CONTRACTS.casinoCore
    );
    expect(Casino.contracts.casinoCore.blockExplorerUrl).to.equal(
      `https://polygonscan.com/address/${DEPLOYED_CASINO_CONTRACTS.casinoCore}`
    );
    expect(Casino.contracts.casinoReserve.blockExplorerUrl).to.equal(
      `https://polygonscan.com/address/${DEPLOYED_CASINO_CONTRACTS.casinoReserve}`
    );
  });

  it('should validate 40-character EVM addresses and 64-character deployed hashes', () => {
    expect(isValidAddress('0x9fb4bb44d8d962d695fc93b3dc15f1b287391077')).to.equal(true);
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
    expect(isPlaceholder(DEPLOYED_CASINO_CONTRACTS.casinoCore)).to.equal(false);
    expect(isPlaceholder('0x9fb4bb44d8d962d695fc93b3dc15f1b287391077')).to.equal(false);
  });

  it('should create contract info with displayAddress and isDeployed flags', () => {
    const deployedInfo = createContractInfo(DEPLOYED_CASINO_CONTRACTS.casinoCore);
    expect(deployedInfo.isDeployed).to.equal(true);
    expect(deployedInfo.displayAddress).to.equal(DEPLOYED_CASINO_CONTRACTS.casinoCore);
    expect(deployedInfo.blockExplorerUrl).to.include(DEPLOYED_CASINO_CONTRACTS.casinoCore);

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
