import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("BLS12381 Precompiles Test", function () {
  it("Should deploy BLS12381Test contract", async function () {
    const blsTest = await ethers.deployContract("BLS12381Test");
    
    expect(blsTest.target).to.be.properAddress;
    console.log("BLS12381Test contract deployed at:", blsTest.target);
  });

  it("Should test G1ADD with zero points", async function () {
    const blsTest = await ethers.deployContract("BLS12381Test");
    
    // Create zero G1 points (128 bytes each - EIP-2537 format)
    const zeroPoint1 = new Uint8Array(128); // 128 bytes (G1 identity/infinity point)
    const zeroPoint2 = new Uint8Array(128); // 128 bytes (G1 identity/infinity point)
    
    const tx = await blsTest.testG1Add(
      ethers.hexlify(zeroPoint1),
      ethers.hexlify(zeroPoint2)
    );
    const receipt = await tx.wait();
    
    console.log("G1ADD transaction status:", receipt?.status);
    expect(receipt?.status).to.equal(1);
    
    // Verify the call returns success
    const result = await blsTest.testG1Add.staticCall(
      ethers.hexlify(zeroPoint1),
      ethers.hexlify(zeroPoint2)
    );
    console.log("G1ADD call success:", result[0]);
    console.log("G1ADD result length:", result[1].length, "bytes");
    expect(result[0]).to.be.true;
  });

  it("Should test MAP_FP_TO_G1 with zero field element", async function () {
    const blsTest = await ethers.deployContract("BLS12381Test");
    
    // Create zero field element (64 bytes) - EIP-2537 requires 64-byte input
    const zeroFp = ethers.getBytes("0x" + "0".repeat(128));
    
    const tx = await blsTest.testMapFpToG1(zeroFp);
    const receipt = await tx.wait();
    
    console.log("MAP_FP_TO_G1 transaction status:", receipt?.status);
    expect(receipt?.status).to.equal(1);
    
    // Verify the call returns success
    const result = await blsTest.testMapFpToG1.staticCall(zeroFp);
    console.log("MAP_FP_TO_G1 call success:", result[0]);
    console.log("MAP_FP_TO_G1 result length:", result[1].length, "bytes");
    expect(result[0]).to.be.true;
  });

  it("Should test identity elements", async function () {
    const blsTest = await ethers.deployContract("BLS12381Test");
    
    const tx = await blsTest.testIdentityElements();
    const receipt = await tx.wait();
    
    console.log("Identity elements test transaction status:", receipt?.status);
    expect(receipt?.status).to.equal(1);
  });

  it("Should handle invalid input length for G1ADD", async function () {
    const blsTest = await ethers.deployContract("BLS12381Test");
    
    const shortPoint = ethers.getBytes("0x" + "0".repeat(64)); // 32 bytes (too short)
    
    await expect(
      blsTest.testG1Add(shortPoint, shortPoint)
    ).to.be.revertedWith("G1 point must be 128 bytes");
  });

  it("Should handle invalid input length for MAP_FP_TO_G1", async function () {
    const blsTest = await ethers.deployContract("BLS12381Test");
    
    const shortFp = ethers.getBytes("0x" + "0".repeat(64)); // 32 bytes (too short)

    await expect(
      blsTest.testMapFpToG1(shortFp)
    ).to.be.revertedWith("Field element must be 64 bytes");
  });
});
