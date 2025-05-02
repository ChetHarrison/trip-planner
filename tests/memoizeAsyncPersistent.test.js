import { memoizeAsyncPersistent } from '../public/js/utils/memoize.js';
import { jest } from '@jest/globals';

describe("memoizeAsyncPersistent", () => {
  it("caches and persists results", async () => {
    const asyncFn = jest.fn(async (x) => x + 1);
    const memoized = memoizeAsyncPersistent(asyncFn);

    const result1 = await memoized(1);
    const result2 = await memoized(1);

    expect(result1).toBe(2);
    expect(result2).toBe(2);
    expect(asyncFn).toHaveBeenCalledTimes(1);
  });
});
