export function getLabelMetrics(lineCount: number, fontSize: number) {
  const lineHeight = fontSize * 1.12;
  const blockHeight = lineCount === 1 ? fontSize : fontSize + lineHeight * (lineCount - 1);
  const baselineOffset = Math.max(0, blockHeight - fontSize) / 2;
  return { lineHeight, baselineOffset };
}

export function splitStationName(name: string, wrapThreshold = 11) {
  const threshold = Math.max(4, Math.min(30, Math.round(wrapThreshold || 11)));
  if (name.length <= threshold) return { lines: [name], fontSize: 5.5 };
  const cleanName = name.replace(/\s+/g, ' ').trim();
  const breakMatch = [...cleanName.matchAll(/[.·\s]/g)]
    .map((match) => match.index ?? 0)
    .filter((index) => index > 1 && index < cleanName.length - 2)
    .sort((a, b) => Math.abs(cleanName.length / 2 - a) - Math.abs(cleanName.length / 2 - b))[0];

  if (breakMatch) {
    const first = cleanName.slice(0, breakMatch + 1).trim();
    const second = cleanName.slice(breakMatch + 1).trim();
    return { lines: [first, second], fontSize: cleanName.length > 18 ? 4.2 : 4.8 };
  }

  if (cleanName.length <= 12) {
    return { lines: [cleanName.slice(0, 6), cleanName.slice(6)], fontSize: 5.1 };
  }
  const breakPoint = Math.ceil(cleanName.length / 2);
  return { lines: [cleanName.slice(0, breakPoint), cleanName.slice(breakPoint)], fontSize: cleanName.length > 18 ? 4.2 : 4.7 };
}
