let generation = 0

export function currentSessionGeneration(): number {
  return generation
}

export function invalidateSessionGeneration(): void {
  generation++
}
