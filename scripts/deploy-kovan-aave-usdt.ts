import 'tsconfig-paths/register';

import { deployAaveController, deployAaveProvider, deployBondModelV2Linear, deployJuniorBond, deploySeniorBond, deploySmartYield, deployYieldOracle } from '@testhelp/index';
import { Wallet, BigNumber as BN } from 'ethers';
import { run, ethers } from 'hardhat';
import { IATokenFactory } from '@typechain/IATokenFactory';

const A_HOUR = 60 * 60;

const seniorBondCONF = { name: 'BarnBridge aUSDT sBOND', symbol: 'bb_sBOND_aUSDT' };
const juniorBondCONF = { name: 'BarnBridge aUSDT jBOND', symbol: 'bb_jBOND_aUSDT' };
const juniorTokenCONF = { name: 'BarnBridge aUSDT', symbol: 'bb_aUSDT' };

const oracleCONF = { windowSize: A_HOUR, granularity: 4 };

// barnbridge
const decimals = 6; // same as USDT
const dao = '0x930e52B96320d7dBbfb6be458e5EE0Cd3E5E5Dac';
const feesOwner = dao;

// externals ---

// aave
const aUSDT = '0xFF3c8bc103682FA918c954E84F5056aB4DD5189d';

async function main() {

  const [deployerSign, ...signers] = (await ethers.getSigners()) as unknown[] as Wallet[];

  console.log('Deployer:', deployerSign.address);
  console.log('Others:', signers.map(a => a.address));

  const aToken = IATokenFactory.connect(aUSDT, deployerSign);
  const underlyingTOKEN = await aToken.callStatic.UNDERLYING_ASSET_ADDRESS();

  const bondModel = await deployBondModelV2Linear(deployerSign);

  const pool = await deployAaveProvider(deployerSign, aUSDT);

  const smartYield = await deploySmartYield(deployerSign, juniorTokenCONF.name, juniorTokenCONF.symbol, BN.from(decimals));
  const seniorBond = await deploySeniorBond(deployerSign, smartYield.address, seniorBondCONF.name, seniorBondCONF.symbol);
  const juniorBond = await deployJuniorBond(deployerSign, smartYield.address, juniorBondCONF.name, juniorBondCONF.symbol);

  const controller = await deployAaveController(deployerSign, pool.address, smartYield.address, bondModel.address, deployerSign.address);
  const oracle = await deployYieldOracle(deployerSign, controller.address, oracleCONF.windowSize, oracleCONF.granularity);

  await (await controller.setOracle(oracle.address)).wait(2);
  await (await controller.setFeesOwner(feesOwner)).wait(2);
  await (await smartYield.setup(controller.address, pool.address, seniorBond.address, juniorBond.address)).wait(2);
  await (await pool.setup(smartYield.address, controller.address)).wait(2);

  await (await controller.setGuardian(dao)).wait(2);
  await (await controller.setDao(dao)).wait(2);

  console.log('CONF --------');
  console.log('DAO:', dao);
  console.log('aUSDT:', aUSDT);
  console.log('USDT:', underlyingTOKEN);
  console.log('');
  console.log('DEPLOYED ----');
  console.log('bondModel:', bondModel.address);
  console.log('provider:', pool.address);
  console.log('smartYield:', smartYield.address);
  console.log('seniorBond:', seniorBond.address);
  console.log('juniorBond:', juniorBond.address);
  console.log('controller:', controller.address);
  console.log('oracle:', oracle.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
