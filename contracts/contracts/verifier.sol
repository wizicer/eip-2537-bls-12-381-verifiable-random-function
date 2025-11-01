// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title Ring/VRF-style verifier over BLS12-381 using EIP-2537 precompiles
/// @notice Implements:
///  R  = s1*G - c*pk
///  Rm = s1*H_G(in) - c*preout
///  check c == Hp(in, pk, preout, R, Rm)
///  if ok => out = H(preout, in)
/// @dev Uses EIP-2537 precompiles: G1 MSM (0x0c) and MAP_FP_TO_G1 (0x10). Encodings per spec.
///      G1 points are 128 bytes (x||y), each coordinate is 64-byte big-endian Fp element (top 16 bytes zero).
contract EIP2537VrfStyleVerifier {
    // --- EIP-2537 precompile addresses (per spec) ---
    address constant BLS12_G1MSM       = address(0x0c);
    address constant BLS12_MAP_FP_TO_G1= address(0x10);

    // Gas costs for precompiles (per EIP-2537)
    uint256 constant G1MSM_GAS = 50000; // For 2-term MSM, need sufficient gas
    uint256 constant MAP_FP_TO_G1_GAS = 5500;

    // --- BLS12-381 constants (per spec) ---
    // Main subgroup order q
    uint256 constant Q =
        0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001;

    // G1 generator (BASE) from @noble/curves/bls12-381 in EIP-2537 format (128 bytes: X(64) || Y(64), both big-endian).
    // This matches bls12_381.G1.ProjectivePoint.BASE used in JavaScript code.
    // Format: [0x00...00(16) || x(48) || 0x00...00(16) || y(48)] = 128 bytes
    bytes constant G1_GENERATOR = hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb0000000000000000000000000000000008b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1";

    // --- Errors ---
    error PrecompileFailure();   // low-level call to precompile failed (bad encoding/out of subgroup, etc.)
    error PrecompileG1MsmFailure();   // G1MSM precompile failed (bad encoding/out of subgroup, etc.)
    error PrecompileMapToG1Failure();   // MAP_FP_TO_G1 precompile failed (bad encoding/out of subgroup, etc.)
    error InvalidPointLength();  // pk/preout not 128 bytes
    error InvalidScalar();       // c or s1 not in [0, Q) (optional check)

    // --- Public API ---

    /// @param pk     G1 public key, 128-byte uncompressed (x||y), big-endian limbs as per EIP-2537
    /// @param inBlob Arbitrary input bytes "in"
    /// @param c      Fiat–Shamir challenge (interpreted mod q)
    /// @param s1     Response scalar (interpreted mod q)
    /// @param preout G1 point, 128-byte uncompressed (x||y), purported VRF pre-output
    /// @return ok    true if verified
    /// @return out   keccak256(preout || inBlob) when ok, otherwise bytes32(0)
    function verify(
        bytes calldata pk,
        bytes calldata inBlob,
        uint256 c,
        uint256 s1,
        bytes calldata preout
    ) external returns (bool ok, bytes32 out) {
        if (pk.length != 128 || preout.length != 128) revert InvalidPointLength();

        // Optionally bound scalars into [0, q). (If caller already reduces, this is a no-op.)
        if (c >= Q || s1 >= Q) revert InvalidScalar();

        // 1) Compute H_G(in): hash-to-field (bytes -> Fp) then MAP_FP_TO_G1.
        //    We use a simple hash_to_field: fp = be64(0) || be32(keccak(in)) which is < p.
        bytes memory hIn = _mapToG1(inBlob); // 128 bytes (G1 point)

        // 2) R = s1*G + (q-c)*pk   (since -c*pk == (q-c)*pk mod q)
        bytes memory R = _g1Msm2(
            G1_GENERATOR, s1,
            pk, _negateModQ(c)
        );

        // 3) Rm = s1*H(in) + (q-c)*preout
        bytes memory Rm = _g1Msm2(
            hIn, s1,
            preout, _negateModQ(c)
        );

        // 4) Recompute c' = Hp(in, pk, preout, R, Rm) = keccak256(...) mod q
        uint256 cPrime = _hashToScalarQ(
            abi.encodePacked(inBlob, pk, preout, R, Rm)
        );

        if (cPrime != c) {
            return (false, bytes32(0));
        }

        // 5) out = H(preout, in) = keccak256(preout || inBlob)
        return (true, keccak256(abi.encodePacked(preout, inBlob)));
    }

    // --- Internals ---

    /// @dev Compute (q - c) mod q; when c==0 returns 0.
    function _negateModQ(uint256 c) private pure returns (uint256) {
        if (c == 0) return 0;
        unchecked { return Q - (c % Q); }
    }

    /// @dev Hash arbitrary bytes to a field element encoding (64 bytes big-endian) for MAP_FP_TO_G1.
    ///      Construction: 64 bytes with the top 32 bytes zero, low 32 = keccak256(data).
    function _hashToFp(bytes memory data) private pure returns (bytes memory fp64) {
        bytes32 h = keccak256(data);
        fp64 = new bytes(64);
        // top 32 bytes already zero (Solidity zeros new memory)
        assembly {
            mstore(add(fp64, 64), h) // write h at the tail (low limb) => big-endian 64 = 0x00..00 || h
        }
    }

    /// @dev Map bytes to G1 point using MAP_FP_TO_G1 precompile (matching vrf.ts H_G function).
    ///      First hashes input bytes with keccak256, then converts to Fp element and maps to G1 point.
    ///      Input: arbitrary bytes; Output: 128 bytes (G1 point in EIP-2537 format).
    ///      Algorithm: data -> keccak256(data) -> Fp (64 bytes: [0x00...00(32) || hash(32)]) -> MAP_FP_TO_G1 -> G1 point
    ///      NOTE: keccak256 outputs 32 bytes, which is guaranteed < p (381 bits), so no mod p needed.
    function _mapToG1(bytes memory data) private returns (bytes memory out128) {
        // First, hash input bytes with keccak256 (outputs 32 bytes)
        bytes32 h = keccak256(data);
        
        // Convert to Fp element (64 bytes, big-endian)
        // Format: [0x00...00(32) || keccak256(data)(32)] = 64 bytes
        // This ensures the value < p (since keccak256 output is 32 bytes < 381 bits)
        bytes memory fp64 = new bytes(64);
        assembly {
            mstore(add(fp64, 64), h) // Write hash at tail (low 32 bytes) => big-endian 64 = 0x00..00 || h
        }
        
        // MAP_FP_TO_G1 -> G1 point
        (bool ok, bytes memory result) = BLS12_MAP_FP_TO_G1.call{gas: MAP_FP_TO_G1_GAS}(fp64);
        if (!ok) revert PrecompileMapToG1Failure();
        if (result.length != 128) revert PrecompileMapToG1Failure();
        out128 = result;
    }

    /// @dev Two-term G1 MSM: returns 128-byte point for (s1*P1 + s2*P2).
    ///      Encodes per EIP-2537: [P1(128) || s1(32) || P2(128) || s2(32)] and calls 0x0c.
    ///      Format: For each pair, [point(128) || scalar(32)], concatenated.
    ///      No pair count prefix - format determined by input length.
    ///      Uses the same call syntax as BLS12381Test for consistency.
    function _g1Msm2(
        bytes memory P1, uint256 s1,
        bytes memory P2, uint256 s2
    ) private returns (bytes memory out128) {
        if (P1.length != 128 || P2.length != 128) revert InvalidPointLength();

        // EIP-2537 format: [P1(128) || s1(32) || P2(128) || s2(32)] = 320 bytes
        // Use abi.encodePacked exactly like BLS12381Test (which works successfully)
        // Convert uint256 to bytes32 for encoding
        bytes memory input = abi.encodePacked(P1, bytes32(s1), P2, bytes32(s2));

        // Use Solidity high-level call syntax exactly like BLS12381Test
        // This matches: (success, result) = BLS12_G1MSM.call{gas: G1MSM_GAS}(input);
        (bool ok, bytes memory result) = BLS12_G1MSM.call{gas: G1MSM_GAS}(input);
        if (!ok || result.length != 128) revert PrecompileG1MsmFailure();
        
        out128 = result;
    }

    /// @dev Convert uint256 to 32-byte big-endian bytes.
    function _u256ToBe32(uint256 x) private pure returns (bytes memory out) {
        out = new bytes(32);
        assembly { mstore(add(out, 0x20), x) }
        // mstore writes as big-endian for bytes? No—mstore stores the word verbatim.
        // We need to big-endian swap because Solidity treats bytes as big-endian when compared lexicographically,
        // but precompile expects big-endian encoding of the integer.
        // However, EVM words are big-endian when interpreted as bytes in memory, so the 32-byte sequence already matches BE.
        // No further action needed.
    }

    /// @dev memcpy helper
    function _memcpy(
        bytes memory dst, uint256 dstOff,
        bytes memory src, uint256 srcOff,
        uint256 len
    ) private pure {
        assembly {
            // Pointers to starts
            let d := add(add(dst, 0x20), dstOff)
            let s := add(add(src, 0x20), srcOff)
            // copy 32-byte chunks
            for { let end := add(s, len) } lt(s, end) { s := add(s, 0x20) d := add(d, 0x20) } {
                mstore(d, mload(s))
            }
        }
    }

    /// @dev Hash to scalar in Z_q: keccak256(bytes) mod q.
    function _hashToScalarQ(bytes memory data) private pure returns (uint256) {
        return uint256(keccak256(data)) % Q;
    }
}
