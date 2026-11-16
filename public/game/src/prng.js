export function createPrng(initialSeed = 1) {
  let state = (initialSeed >>> 0) || 1;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + (max - min) * this.next();
    },
    pickWeighted(table) {
      let total = 0;
      const entries = Object.entries(table);
      for (const [, w] of entries) total += w;
      let roll = this.next() * total;
      for (const [key, w] of entries) {
        roll -= w;
        if (roll <= 0) return key;
      }
      return entries[0][0];
    },
  };
}
