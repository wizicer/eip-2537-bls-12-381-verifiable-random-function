import { bls12_381 } from '@noble/curves/bls12-381';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { keccak256, getBytes } from 'ethers';

// BLS12-381 curve order (r - the order of G1/G2 subgroups)
const CURVE_ORDER = bls12_381.params.r;

/**
 * 将输入数据进行哈希，然后 mod p（BLS12-381 的阶）
 * @param inputs 输入数据数组
 * @returns 哈希后 mod p 的 bigint 值
 */
export function H_p(...inputs: (string | Uint8Array | bigint)[]): bigint {
  // 将所有输入拼接
  let combinedBytes: Uint8Array[] = [];
  
  for (const input of inputs) {
    if (typeof input === 'string') {
      // 将字符串转换为字节
      combinedBytes.push(new TextEncoder().encode(input));
    } else if (input instanceof Uint8Array) {
      combinedBytes.push(input);
    } else if (typeof input === 'bigint') {
      // 将 bigint 转换为 32 字节
      const hex = input.toString(16).padStart(64, '0');
      combinedBytes.push(hexToBytes(hex));
    }
  }
  
  // 拼接所有字节
  const totalLength = combinedBytes.reduce((sum, arr) => sum + arr.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const bytes of combinedBytes) {
    combined.set(bytes, offset);
    offset += bytes.length;
  }
  
  // 使用 ethers 的 keccak256 进行哈希
  const hash = keccak256(combined);
  
  // 转换为 bigint 并 mod p
  const hashBigInt = BigInt(hash);
  return hashBigInt % CURVE_ORDER;
}

// 定义点类型（mapToCurve 返回 H2CPoint，但可以通过 .toAffine() 和 ProjectivePoint.fromAffine() 转换）
// 为了兼容性，我们使用 ProjectivePoint 类型
export type G1Point = ReturnType<typeof bls12_381.G1.ProjectivePoint.fromAffine>;

/**
 * Hash to Curve: 将输入哈希映射到 BLS12-381 曲线上的点
 * @param input 输入数据
 * @returns 曲线上的点
 */
export function H_G(input: string | Uint8Array): G1Point {
  let inputBytes: Uint8Array;
  
  if (typeof input === 'string') {
    // 如果是字符串，转换为字节
    inputBytes = new TextEncoder().encode(input);
  } else {
    inputBytes = input;
  }
  
  // 先对 inputBytes 进行 keccak256 哈希（与 Solidity 保持一致）
  // keccak256 输出 32 字节，远小于 381 位的 p，确保值 < p
  const hash = keccak256(inputBytes);
  const hashBytes = getBytes(hash);
  
  // 构造 64 字节的 Fp 元素：前 32 字节为 0，后 32 字节为 keccak256 哈希值
  // 格式：[0x00...00(32) || keccak256(inputBytes)(32)] = 64 bytes (big-endian)
  const fp64 = new Uint8Array(64);
  fp64.set(hashBytes, 32); // 将哈希值放在后 32 字节（big-endian，低字节在末尾）
  
  // 转换为 bigint（域元素）
  const fpHex = '0x' + Array.from(fp64)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const fpBigInt = BigInt(fpHex);
  
  // 使用 mapToCurve 映射单个域元素
  // mapToCurve([u]) 等价于 MAP_FP_TO_G1(u) 在 Solidity 中
  // Fp.create 会自动进行 mod p，但由于 keccak256 输出 < p，所以值保持不变
  const h2cPoint = bls12_381.G1.mapToCurve([fpBigInt]);
  
  // H2CPoint 可以转换为 ProjectivePoint（通过 toAffine 然后 fromAffine）
  const affine = h2cPoint.toAffine();
  const point = bls12_381.G1.ProjectivePoint.fromAffine(affine);
  
  return point as G1Point;
}

/**
 * 将点序列化为字节数组
 */
function pointToBytes(point: G1Point): Uint8Array {
  // G1Point 是 ProjectivePoint，可以直接使用 toRawBytes
  return (point as any).toRawBytes(true); // compressed format
}

// 将 ProjectivePoint 编码为 EIP-2537 G1 格式（128 字节：X(64) || Y(64)，每个坐标前 16 字节 0 填充）
function pointToEip2537(point: G1Point): Uint8Array {
  const uncompressed = (point as any).toRawBytes(false) as Uint8Array; // 96 bytes = X(48) || Y(48)
  const out = new Uint8Array(128);
  // X 放到 [16..64)
  out.set(uncompressed.slice(0, 48), 16);
  // Y 放到 [80..128)
  out.set(uncompressed.slice(48, 96), 80);
  return out;
}

/**
 * VRF Prover 输出
 */
export interface VRFProof {
  c: bigint;
  s_1: bigint;
  preout: Uint8Array;
}

/**
 * VRF Prover 计算
 * @param sk 私钥（scalar）
 * @param pk 公钥（曲线上的点）
 * @param input 输入数据
 * @param r_1 可选的随机数（用于测试，生产环境应该自动生成）
 * @returns VRF 证明
 */
export function prove(
  sk: bigint,
  pk: G1Point,
  input: string | Uint8Array,
  r_1?: bigint
): VRFProof {
  // 1. 计算 preout = sk · H_G(in)
  const H_in = H_G(input);
  const preout_point = H_in.multiply(sk);
  
  // 2. 在 F_p 中选取随机数 r_1（如果未提供）
  if (r_1 === undefined) {
    const r_1_bytes = bls12_381.utils.randomPrivateKey();
    r_1 = BigInt('0x' + bytesToHex(r_1_bytes)) % CURVE_ORDER;
  }
  
  // 3. 计算 R = r_1 · G 和 R_m = r_1 · H_G(in)
  const R = bls12_381.G1.ProjectivePoint.BASE.multiply(r_1);
  const R_m = H_in.multiply(r_1);
  
  // 4. 计算 c = H_p(in, pk, preout, R, R_m)
  let inputBytes: Uint8Array;
  if (typeof input === 'string') {
    inputBytes = new TextEncoder().encode(input);
  } else {
    inputBytes = input;
  }
  
  const c = H_p(
    inputBytes,
    pointToEip2537(pk),
    pointToEip2537(preout_point),
    pointToEip2537(R),
    pointToEip2537(R_m)
  );
  
  // 5. 计算 s_1 = r_1 + c · sk
  const s_1 = (r_1 + c * sk) % CURVE_ORDER;
  
  return {
    c,
    s_1,
    // 注意：为了兼容链上测试，这里返回压缩格式（48 字节）
    preout: pointToBytes(preout_point),
  };
}

/**
 * VRF Verifier 验证
 * @param pk 公钥
 * @param input 输入数据
 * @param proof VRF 证明
 * @returns 验证成功返回随机输出，失败返回 null
 */
export function verify(
  pk: G1Point,
  input: string | Uint8Array,
  proof: VRFProof
): Uint8Array | null {
  const { c, s_1, preout } = proof;
  
  // 从字节恢复 preout 点
  const preout_point = bls12_381.G1.ProjectivePoint.fromHex(bytesToHex(preout));
  
  // 1. 计算 R = s_1 · G - c · pk
  const s1_G = bls12_381.G1.ProjectivePoint.BASE.multiply(s_1);
  const c_pk = pk.multiply(c);
  const R = s1_G.subtract(c_pk);
  
  // 1. 计算 R_m = s_1 · H_G(in) - c · preout
  const H_in = H_G(input);
  const s1_H = H_in.multiply(s_1);
  const c_preout = preout_point.multiply(c);
  const R_m = s1_H.subtract(c_preout);
  
  // 2. 判断 c = H_p(in, pk, preout, R, R_m)
  let inputBytes: Uint8Array;
  if (typeof input === 'string') {
    inputBytes = new TextEncoder().encode(input);
  } else {
    inputBytes = input;
  }
  
  // 将 preout 从字节恢复为点再编码为 EIP-2537
  const preout_eip = pointToEip2537(preout_point);
  const c_computed = H_p(
    inputBytes,
    pointToEip2537(pk),
    preout_eip,
    pointToEip2537(R),
    pointToEip2537(R_m)
  );
  
  // 3. 如果相等，计算 out = H(preout, in) 并输出 out，否则输出 false
  if (c_computed !== c) {
    return null;
  }
  
  // 计算最终输出 out = H(preout, in)
  const hash = keccak256(
    '0x' + bytesToHex(preout) + bytesToHex(inputBytes)
  );
  
  return hexToBytes(hash.slice(2));
}

/**
 * 生成密钥对
 * @returns { sk: 私钥, pk: 公钥 }
 */
export function generateKeyPair(): {
  sk: bigint;
  pk: G1Point;
} {
  const skBytes = bls12_381.utils.randomPrivateKey();
  const sk = BigInt('0x' + bytesToHex(skBytes)) % CURVE_ORDER;
  const pk = bls12_381.G1.ProjectivePoint.BASE.multiply(sk);
  
  return { sk, pk };
}

