/**
 * Code 128 条码编码器（标准 ISO/IEC 15417）。
 * - 纯数字且位数为偶数（≥4）时用 Code C，条码更短
 * - 其他情况用 Code B，支持 ASCII 32–126（英文、数字、常见符号）
 */

/** 0–106 号符号的条/空宽度（单位：模块），条空交替，从条开始 */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const START_C = 105;
const STOP = 106;

/** 两侧静区宽度（模块），扫码必需 */
export const QUIET_ZONE = 10;

export const canEncode = (value: string) => /^[\x20-\x7e]+$/.test(value);

function symbolValues(value: string): number[] {
  if (/^(\d\d){2,}$/.test(value)) {
    const out = [START_C];
    for (let i = 0; i < value.length; i += 2) out.push(Number(value.slice(i, i + 2)));
    return out;
  }
  if (!canEncode(value)) {
    throw new Error(`Code 128 无法编码 "${value}"：只支持英文、数字和常见符号（ASCII 32–126）`);
  }
  return [START_B, ...[...value].map((ch) => ch.charCodeAt(0) - 32)];
}

export interface Code128 {
  /** 每根条的起点和宽度（模块），已包含左侧静区偏移 */
  bars: { x: number; w: number }[];
  /** 总宽度（模块），含两侧静区 */
  width: number;
}

export function encodeCode128(value: string): Code128 {
  const symbols = symbolValues(value);
  const checksum = symbols.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
  const widths = [...symbols, checksum, STOP].map((v) => PATTERNS[v]).join('');

  const bars: Code128['bars'] = [];
  let x = QUIET_ZONE;
  [...widths].forEach((d, i) => {
    const w = Number(d);
    if (i % 2 === 0) bars.push({ x, w });
    x += w;
  });
  return { bars, width: x + QUIET_ZONE };
}

/** 调试用：返回 1/0 模块序列（不含静区） */
export function toBinary(value: string): string {
  const { bars, width } = encodeCode128(value);
  const cells = Array<string>(width - QUIET_ZONE * 2).fill('0');
  for (const b of bars) for (let i = 0; i < b.w; i++) cells[b.x - QUIET_ZONE + i] = '1';
  return cells.join('');
}
