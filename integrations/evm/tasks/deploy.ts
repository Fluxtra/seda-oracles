import { task } from "hardhat/config";
import { getSedaCoreAddress } from "../seda.config";

task("deploy", "Deploy a price feed contract")
  .addParam("feed", "Feed name: hype-usd, mantra-usd, or hype-mantra")
  .addParam("programid", "Oracle program ID (bytes32 hex)")
  .addOptionalParam("staleness", "Staleness threshold in seconds", "3600")
  .setAction(async (taskArgs, hre) => {
    const { feed, programid, staleness } = taskArgs;
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const sedaCore = getSedaCoreAddress(Number(chainId));

    const contractMap: Record<string, string> = {
      "hype-usd": "HypeUsdPriceFeed",
      "mantra-usd": "MantraUsdPriceFeed",
      "hype-mantra": "HypeMantraPriceFeed",
    };

    const contractName = contractMap[feed];
    if (!contractName) throw new Error(`Unknown feed: ${feed}`);

    console.log(`Deploying ${contractName}...`);
    console.log(`  SEDA Core: ${sedaCore}`);
    console.log(`  Oracle Program ID: ${programid}`);
    console.log(`  Staleness Threshold: ${staleness}s`);

    const Factory = await hre.ethers.getContractFactory(contractName);
    const contract = await Factory.deploy(sedaCore, programid, BigInt(staleness));
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`${contractName} deployed to: ${address}`);
  });

task("deploy-all", "Deploy all 3 price feed contracts")
  .addParam("hypeusdid", "HYPE/USD oracle program ID")
  .addParam("mantrausdid", "MANTRA/USD oracle program ID")
  .addParam("hypemantraid", "HYPE/MANTRA oracle program ID")
  .addOptionalParam("staleness", "Staleness threshold in seconds", "3600")
  .setAction(async (taskArgs, hre) => {
    const { hypeusdid, mantrausdid, hypemantraid, staleness } = taskArgs;

    for (const [feed, programId] of [
      ["hype-usd", hypeusdid],
      ["mantra-usd", mantrausdid],
      ["hype-mantra", hypemantraid],
    ]) {
      await hre.run("deploy", { feed, programid: programId, staleness });
    }
  });
