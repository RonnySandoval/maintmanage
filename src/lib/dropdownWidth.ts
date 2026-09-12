export function longestWord(labels: Iterable<string>): string {
  let best = ''
  for (const label of labels) {
    for (const word of label.split(/\s+/)) {
      if (word.length > best.length) best = word
    }
  }
  return best
}

export function menuMaxCh(labels: Iterable<string>, min = 8): number {
  return Math.max(min, longestWord(labels).length)
}
