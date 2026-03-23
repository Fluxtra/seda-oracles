import { task } from "hardhat/config";

task("transmit", "Post a new data request via transmit()")
  .addParam("contract", "Price feed contract address")
  .addOptionalParam("value", "ETH value to send (in wei)", "0")
  .setAction(async (taskArgs, hre) => {
    const { contract: addr, value } = taskArgs;

    const feed = await hre.ethers.getContractAt("SedaPriceFeedBase", addr);
    const tx = await feed.transmit({ value: BigInt(value) });
    const receipt = await tx.wait();
    console.log(`Transmit tx: ${receipt?.hash}`);

    const requestId = await feed.latestRequestId();
    console.log(`Request ID: ${requestId}`);
  });
