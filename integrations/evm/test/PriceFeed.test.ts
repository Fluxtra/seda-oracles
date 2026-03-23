import { expect } from "chai";
import { ethers } from "hardhat";

describe("Price Feed Contracts", function () {
  let mockCore: any;
  let hypeUsd: any;
  let owner: any;
  let other: any;

  const PROGRAM_ID = ethers.encodeBytes32String("test-program");
  const STALENESS = 3600;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    const MockCore = await ethers.getContractFactory("MockSedaCore");
    mockCore = await MockCore.deploy();

    const HypeUsd = await ethers.getContractFactory("HypeUsdPriceFeed");
    hypeUsd = await HypeUsd.deploy(
      await mockCore.getAddress(),
      PROGRAM_ID,
      STALENESS
    );
  });

  describe("deployment", function () {
    it("sets correct description", async function () {
      expect(await hypeUsd.description()).to.equal("HYPE / USD");
    });

    it("sets correct decimals", async function () {
      expect(await hypeUsd.decimals()).to.equal(18);
    });

    it("sets correct oracle program ID", async function () {
      expect(await hypeUsd.oracleProgramId()).to.equal(PROGRAM_ID);
    });
  });

  describe("transmit", function () {
    it("posts request and stores request ID", async function () {
      await hypeUsd.transmit();
      const requestId = await hypeUsd.latestRequestId();
      expect(requestId).to.not.equal(ethers.ZeroHash);
    });

    it("emits RequestTransmitted event", async function () {
      await expect(hypeUsd.transmit()).to.emit(hypeUsd, "RequestTransmitted");
    });
  });

  describe("fetchResult", function () {
    it("reverts if no request transmitted", async function () {
      await expect(hypeUsd.fetchResult()).to.be.revertedWithCustomError(
        hypeUsd,
        "RequestNotTransmitted"
      );
    });

    it("updates price on valid result", async function () {
      await hypeUsd.transmit();
      const requestId = await hypeUsd.latestRequestId();

      // Encode a price of 25.5 * 1e18 as big-endian u128
      const price = 25500000000000000000n;
      const priceHex = price.toString(16).padStart(32, "0");
      const resultBytes = "0x" + priceHex;

      await mockCore.setResult(requestId, {
        drId: requestId,
        gasUsed: 0,
        blockHeight: 1,
        blockTimestamp: Math.floor(Date.now() / 1000),
        consensus: true,
        exitCode: 0,
        version: "0.0.1",
        result: resultBytes,
        paybackAddress: "0x",
        sedaPayload: "0x",
      });

      await hypeUsd.fetchResult();
      expect(await hypeUsd.latestAnswer()).to.equal(price);
    });

    it("reverts on no consensus", async function () {
      await hypeUsd.transmit();
      const requestId = await hypeUsd.latestRequestId();

      await mockCore.setResult(requestId, {
        drId: requestId,
        gasUsed: 0,
        blockHeight: 1,
        blockTimestamp: Math.floor(Date.now() / 1000),
        consensus: false,
        exitCode: 0,
        version: "0.0.1",
        result: "0x00000000000000000000000000000000",
        paybackAddress: "0x",
        sedaPayload: "0x",
      });

      await expect(hypeUsd.fetchResult()).to.be.revertedWithCustomError(
        hypeUsd,
        "NoConsensus"
      );
    });
  });

  describe("staleness", function () {
    it("reverts when price is stale", async function () {
      await hypeUsd.transmit();
      const requestId = await hypeUsd.latestRequestId();

      // Set result with old timestamp
      await mockCore.setResult(requestId, {
        drId: requestId,
        gasUsed: 0,
        blockHeight: 1,
        blockTimestamp: 1, // very old
        consensus: true,
        exitCode: 0,
        version: "0.0.1",
        result: "0x00000000000000000000000000000001",
        paybackAddress: "0x",
        sedaPayload: "0x",
      });

      await hypeUsd.fetchResult();
      await expect(hypeUsd.latestAnswerSafe()).to.be.revertedWithCustomError(
        hypeUsd,
        "StalePrice"
      );
    });
  });

  describe("admin", function () {
    it("owner can update oracle program ID", async function () {
      const newId = ethers.encodeBytes32String("new-program");
      await expect(hypeUsd.setOracleProgramId(newId))
        .to.emit(hypeUsd, "OracleProgramIdUpdated");
      expect(await hypeUsd.oracleProgramId()).to.equal(newId);
    });

    it("non-owner cannot update oracle program ID", async function () {
      const newId = ethers.encodeBytes32String("new-program");
      await expect(
        hypeUsd.connect(other).setOracleProgramId(newId)
      ).to.be.revertedWithCustomError(hypeUsd, "OwnableUnauthorizedAccount");
    });
  });
});
