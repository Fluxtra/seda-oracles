import { expect } from "chai";
import { ethers } from "hardhat";

const PROGRAM_ID = ethers.encodeBytes32String("test-program");
const STALENESS = 3600;

/** Build a mock SEDA result. Timestamp defaults to "now" (always fresh). */
function makeResult(requestId: string, overrides: Record<string, any> = {}) {
  return {
    drId: requestId,
    gasUsed: 0,
    blockHeight: 1,
    blockTimestamp: Math.floor(Date.now() / 1000),
    consensus: true,
    exitCode: 0,
    version: "0.0.1",
    result: "0x" + (25500000000000000000n).toString(16).padStart(32, "0"),
    paybackAddress: "0x",
    sedaPayload: "0x",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared base-contract test suite — runs against any concrete feed contract.
// ---------------------------------------------------------------------------
function describeBaseTests(contractName: string, expectedDescription: string) {
  describe(contractName, function () {
    let mockCore: any;
    let feed: any;
    let owner: any;
    let other: any;

    beforeEach(async function () {
      [owner, other] = await ethers.getSigners();
      const MockCore = await ethers.getContractFactory("MockSedaCore");
      mockCore = await MockCore.deploy();
      const Factory = await ethers.getContractFactory(contractName);
      feed = await Factory.deploy(await mockCore.getAddress(), PROGRAM_ID, STALENESS);
    });

    describe("deployment", function () {
      it("sets correct description", async function () {
        expect(await feed.description()).to.equal(expectedDescription);
      });

      it("sets correct decimals", async function () {
        expect(await feed.decimals()).to.equal(18);
      });

      it("sets correct oracle program ID", async function () {
        expect(await feed.oracleProgramId()).to.equal(PROGRAM_ID);
      });

      it("reverts on zero sedaCore address", async function () {
        const Factory = await ethers.getContractFactory(contractName);
        await expect(
          Factory.deploy(ethers.ZeroAddress, PROGRAM_ID, STALENESS)
        ).to.be.revertedWithCustomError(feed, "InvalidAddress");
      });

      it("reverts on zero program ID", async function () {
        const Factory = await ethers.getContractFactory(contractName);
        await expect(
          Factory.deploy(await mockCore.getAddress(), ethers.ZeroHash, STALENESS)
        ).to.be.revertedWithCustomError(feed, "InvalidProgramId");
      });
    });

    describe("transmit", function () {
      it("posts request and stores request ID", async function () {
        await feed.transmit();
        expect(await feed.latestRequestId()).to.not.equal(ethers.ZeroHash);
      });

      it("emits RequestTransmitted event", async function () {
        await expect(feed.transmit()).to.emit(feed, "RequestTransmitted");
      });

      it("reverts when called by non-owner", async function () {
        await expect(
          feed.connect(other).transmit()
        ).to.be.revertedWithCustomError(feed, "OwnableUnauthorizedAccount");
      });

      it("reverts when previous request is pending", async function () {
        await feed.transmit();
        await expect(feed.transmit()).to.be.revertedWithCustomError(
          feed, "RequestPending"
        );
      });

      it("allows transmit after fetchResult", async function () {
        await feed.transmit();
        const requestId = await feed.latestRequestId();
        await mockCore.setResult(requestId, makeResult(requestId));
        await feed.fetchResult();
        // Should succeed now
        await feed.transmit();
      });
    });

    describe("fetchResult", function () {
      it("reverts if no request transmitted", async function () {
        await expect(feed.fetchResult()).to.be.revertedWithCustomError(
          feed, "RequestNotTransmitted"
        );
      });

      it("updates price on valid result", async function () {
        await feed.transmit();
        const requestId = await feed.latestRequestId();
        const price = 25500000000000000000n;
        await mockCore.setResult(requestId, makeResult(requestId));
        await feed.fetchResult();
        expect(await feed.latestAnswer()).to.equal(price);
      });

      it("reverts on no consensus", async function () {
        await feed.transmit();
        const requestId = await feed.latestRequestId();
        await mockCore.setResult(requestId, makeResult(requestId, { consensus: false }));
        await expect(feed.fetchResult()).to.be.revertedWithCustomError(feed, "NoConsensus");
      });

      it("reverts on non-zero exit code", async function () {
        await feed.transmit();
        const requestId = await feed.latestRequestId();
        await mockCore.setResult(requestId, makeResult(requestId, { exitCode: 1 }));
        await expect(feed.fetchResult()).to.be.revertedWithCustomError(feed, "ExecutionFailed");
      });

      it("reverts on result shorter than 16 bytes", async function () {
        await feed.transmit();
        const requestId = await feed.latestRequestId();
        await mockCore.setResult(requestId, makeResult(requestId, { result: "0x0001" }));
        await expect(feed.fetchResult()).to.be.revertedWithCustomError(feed, "InvalidResultLength");
      });
    });

    describe("latestAnswer", function () {
      it("reverts before first fetchResult", async function () {
        await expect(feed.latestAnswer()).to.be.revertedWithCustomError(feed, "NotInitialized");
      });
    });

    describe("staleness", function () {
      it("reverts when price is stale", async function () {
        await feed.transmit();
        const requestId = await feed.latestRequestId();
        // blockTimestamp = 1 is far in the past, always stale
        await mockCore.setResult(requestId, makeResult(requestId, { blockTimestamp: 1 }));
        await feed.fetchResult();
        await expect(feed.latestAnswerSafe()).to.be.revertedWithCustomError(feed, "StalePrice");
      });

      it("reverts on latestAnswerSafe before first fetch", async function () {
        await expect(feed.latestAnswerSafe()).to.be.revertedWithCustomError(feed, "NotInitialized");
      });
    });

    describe("cancelPendingRequest", function () {
      it("allows transmit after cancellation", async function () {
        await feed.transmit();
        await expect(feed.transmit()).to.be.revertedWithCustomError(feed, "RequestPending");
        await expect(feed.cancelPendingRequest())
          .to.emit(feed, "RequestCancelled");
        // Should succeed now
        await feed.transmit();
      });

      it("reverts when no request is pending", async function () {
        await expect(feed.cancelPendingRequest()).to.be.revertedWithCustomError(
          feed, "RequestNotTransmitted"
        );
      });

      it("reverts when result already fetched", async function () {
        await feed.transmit();
        const requestId = await feed.latestRequestId();
        await mockCore.setResult(requestId, makeResult(requestId));
        await feed.fetchResult();
        await expect(feed.cancelPendingRequest()).to.be.revertedWithCustomError(
          feed, "RequestNotTransmitted"
        );
      });

      it("reverts when called by non-owner", async function () {
        await feed.transmit();
        await expect(
          feed.connect(other).cancelPendingRequest()
        ).to.be.revertedWithCustomError(feed, "OwnableUnauthorizedAccount");
      });
    });

    describe("admin", function () {
      it("owner can update oracle program ID", async function () {
        const newId = ethers.encodeBytes32String("new-program");
        await expect(feed.setOracleProgramId(newId))
          .to.emit(feed, "OracleProgramIdUpdated");
        expect(await feed.oracleProgramId()).to.equal(newId);
      });

      it("non-owner cannot update oracle program ID", async function () {
        const newId = ethers.encodeBytes32String("new-program");
        await expect(
          feed.connect(other).setOracleProgramId(newId)
        ).to.be.revertedWithCustomError(feed, "OwnableUnauthorizedAccount");
      });

      it("rejects zero program ID on update", async function () {
        await expect(
          feed.setOracleProgramId(ethers.ZeroHash)
        ).to.be.revertedWithCustomError(feed, "InvalidProgramId");
      });
    });
  });
}

// Run the full base test suite against all 3 concrete contracts
describeBaseTests("HypeUsdPriceFeed", "HYPE / USD");
describeBaseTests("MantraUsdPriceFeed", "MANTRA / USD");
describeBaseTests("HypeMantraPriceFeed", "HYPE / MANTRA");
