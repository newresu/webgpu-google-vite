export function randomBetween(min: number, max: number) {
  if (min === max) {
    throw new Error("`a` and `b` must be different.");
  }
  const length = max - min;
  return Math.floor(Math.random() * length + 1) + min;
}
