import { task } from "hardhat/config";

task("latest", "Read the latest price from a price feed")
  .addParam("contract", "Price feed contract address")
  .setAction(async (taskArgs, hre) => {
    const feed = await hre.ethers.getContractAt("SedaPriceFeedBase", taskArgs.contract);

    const price = await feed.latestAnswer();
    const timestamp = await feed.latestTimestamp();
    const description = await feed.description();
    const decimals = await feed.decimals();

    console.log(`Feed: ${description}`);
    console.log(`Price: ${price} (${decimals} decimals)`);
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Human-readable: ${hre.ethers.formatUnits(price, 18)}`);
  });
