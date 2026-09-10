// Seeded PRNG (mulberry32) so demo data & Monte Carlo runs are reproducible across restarts.
export function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed = 42) {
  const rand = mulberry32(seed);
  return {
    next: () => rand(),
    int: (min, max) => Math.floor(rand() * (max - min + 1)) + min,
    float: (min, max) => rand() * (max - min) + min,
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    bool: (pTrue = 0.5) => rand() < pTrue,
    // Triangular distribution sampler for loss-magnitude modelling (min, most-likely, max)
    triangular: (min, mode, max) => {
      const u = rand();
      const c = (mode - min) / (max - min);
      if (u < c) return min + Math.sqrt(u * (max - min) * (mode - min));
      return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    },
    // Poisson sampler (Knuth) for annual loss-event-frequency modelling
    poisson: (lambda) => {
      if (lambda <= 0) return 0;
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k += 1;
        p *= rand();
      } while (p > L);
      return k - 1;
    },
  };
}
