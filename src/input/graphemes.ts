export function normalizeInputText(text: string): string {
  return text.normalize('NFC')
}

export function segmentGraphemes(
  text: string,
  segmenter?: Pick<Intl.Segmenter, 'segment'> | null,
): string[] {
  const normalized = normalizeInputText(text)
  const activeSegmenter = segmenter === undefined
    ? typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null
    : segmenter
  return activeSegmenter === null
    ? Array.from(normalized)
    : Array.from(activeSegmenter.segment(normalized), ({ segment }) => segment)
}
