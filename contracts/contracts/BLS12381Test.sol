// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

/**
 * @title BLS12381Test
 * @dev Simple test contract for EIP-2537 BLS12-381 precompiles
 * @notice Tests core BLS12-381 operations: G1ADD and MAP_FP_TO_G1
 */
contract BLS12381Test {
    
    // Precompile addresses (EIP-2537)
    address constant BLS12_G1ADD = address(0x0B);        // G1 addition
    address constant BLS12_MAP_FP_TO_G1 = address(0x10);  // Map field element to G1
    address constant BLS12_G1MSM = address(0x0C);         // G1 multi-scalar mul (2-term wrapper below)
    address constant BLS12_G2ADD = address(0x0D);         // G2 addition
    address constant BLS12_G2MSM = address(0x0E);         // G2 multi-scalar mul (2-term wrapper below)
    address constant BLS12_PAIRING = address(0x0F);       // Pairing check
    
    // Gas costs (per EIP-2537)
    uint256 constant G1ADD_GAS = 500;
    uint256 constant MAP_FP_TO_G1_GAS = 5500;
    // G1MSM gas: base_cost + (per_pair_cost * number_of_pairs)
    // For 2-term MSM, increase gas limit significantly
    uint256 constant G1MSM_GAS = 50000; // Increased from 12000 for 2-term MSM
    uint256 constant G2ADD_GAS = 1200;
    uint256 constant G2MSM_GAS = 25000;
    uint256 constant PAIRING_GAS = 80000;
    
    event TestResult(string operation, bool success, bytes result);
    
    /**
     * @dev Test BLS12_G1ADD precompile - adds two G1 points
     * @param p1 First G1 point (128 bytes - EIP-2537 uncompressed format)
     * @param p2 Second G1 point (128 bytes - EIP-2537 uncompressed format)
     * @return success Whether the operation succeeded
     * @return result The result of the operation
     */
    function testG1Add(bytes calldata p1, bytes calldata p2) 
        external 
        returns (bool success, bytes memory result) 
    {
        require(p1.length == 128, "G1 point must be 128 bytes");
        require(p2.length == 128, "G1 point must be 128 bytes");
        
        (success, result) = BLS12_G1ADD.call{gas: G1ADD_GAS}(abi.encodePacked(p1, p2));
        
        emit TestResult("G1ADD", success, result);
        return (success, result);
    }
    
    /**
     * @dev Test BLS12_MAP_FP_TO_G1 precompile - maps field element to G1 point
     * @param fp Field element (64 bytes) - EIP-2537 requires 64-byte input
     * @return success Whether the operation succeeded
     * @return result The result of the operation (G1 point)
     */
    function testMapFpToG1(bytes calldata fp) 
        external 
        returns (bool success, bytes memory result) 
    {
        require(fp.length == 64, "Field element must be 64 bytes");
        
        (success, result) = BLS12_MAP_FP_TO_G1.call{gas: MAP_FP_TO_G1_GAS}(fp);
        
        emit TestResult("MAP_FP_TO_G1", success, result);
        return (success, result);
    }
    
    /**
     * @dev Test BLS12_G1MSM precompile (2-term). Input encoding per EIP-2537:
     *      [P1(128) || s1(32) || P2(128) || s2(32)] -> 128-byte G1 point
     */
    function testG1Msm(
        bytes calldata p1,
        bytes32 s1,
        bytes calldata p2,
        bytes32 s2
    ) external returns (bool success, bytes memory result) {
        require(p1.length == 128 && p2.length == 128, "G1 point must be 128 bytes");
        bytes memory input = abi.encodePacked(p1, s1, p2, s2);
        (success, result) = BLS12_G1MSM.call{gas: G1MSM_GAS}(input);
        emit TestResult("G1MSM", success, result);
        return (success, result);
    }
    
    /**
     * @dev Test BLS12_G2ADD precompile - adds two G2 points
     *      G2 uncompressed point size is 256 bytes (x,y in Fp2; each Fp element 64 bytes)
     */
    function testG2Add(bytes calldata q1, bytes calldata q2)
        external
        returns (bool success, bytes memory result)
    {
        require(q1.length == 256, "G2 point must be 256 bytes");
        require(q2.length == 256, "G2 point must be 256 bytes");
        (success, result) = BLS12_G2ADD.call{gas: G2ADD_GAS}(abi.encodePacked(q1, q2));
        emit TestResult("G2ADD", success, result);
        return (success, result);
    }
    
    /**
     * @dev Test BLS12_G2MSM precompile (2-term). Encoding:
     *      [Q1(256) || s1(32) || Q2(256) || s2(32)] -> 256-byte G2 point
     */
    function testG2Msm(
        bytes calldata q1,
        bytes32 s1,
        bytes calldata q2,
        bytes32 s2
    ) external returns (bool success, bytes memory result) {
        require(q1.length == 256 && q2.length == 256, "G2 point must be 256 bytes");
        bytes memory input = abi.encodePacked(q1, s1, q2, s2);
        (success, result) = BLS12_G2MSM.call{gas: G2MSM_GAS}(input);
        emit TestResult("G2MSM", success, result);
        return (success, result);
    }
    
    
    /**
     * @dev Test BLS12_PAIRING precompile. Each pair uses 384 bytes: G1(128) || G2(256).
     *      Input must be k * 384 bytes; output per spec is 32-byte (bool encoded) or empty on failure.
     */
    function testPairing(bytes calldata pairs)
        external
        returns (bool success, bytes memory result)
    {
        require(pairs.length % 384 == 0, "Pairing input must be k*384 bytes");
        (success, result) = BLS12_PAIRING.call{gas: PAIRING_GAS}(pairs);
        emit TestResult("PAIRING", success, result);
        return (success, result);
    }
    
    /**
     * @dev Test BLS12_MAP_FP2_TO_G2 precompile. Input: 128 bytes (Fp2 element), Output: 256-byte G2 point
     */
    function testMapFp2ToG2(bytes calldata fp2)
        external
        returns (bool success, bytes memory result)
    {
        require(fp2.length == 128, "Field element Fp2 must be 128 bytes");
        (success, result) = address(0x11).call(fp2);
        emit TestResult("MAP_FP2_TO_G2", success, result);
        return (success, result);
    }
    
    /**
     * @dev Test with identity elements (zero points)
     * @return g1AddResult Result of G1ADD with identity elements
     * @return mapResult Result of MAP_FP_TO_G1 with zero
     */
    function testIdentityElements() 
        external 
        returns (bytes memory g1AddResult, bytes memory mapResult) 
    {
        // G1 identity point (all zeros) - 128 bytes for EIP-2537 format
        bytes memory g1Identity = new bytes(128);
        
        // Test G1ADD with identity elements
        (bool success1, bytes memory result1) = this.testG1Add(g1Identity, g1Identity);
        g1AddResult = abi.encode(success1, result1);
        
        // Test MAP_FP_TO_G1 with zero (64 bytes)
        bytes memory zeroFp = new bytes(64);
        (bool success2, bytes memory result2) = this.testMapFpToG1(zeroFp);
        mapResult = abi.encode(success2, result2);
    }
}
