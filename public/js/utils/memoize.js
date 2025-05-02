// public/js/utils/memoize.js

export function memoizeAsyncPersistent(fn, storageKey = 'locationSuggestionsCache') {
  const memoryCache = new Map();
  const saved = localStorage.getItem(storageKey);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      for (const key in parsed) {
        memoryCache.set(key, Promise.resolve(parsed[key]));
      }
    } catch (e) {
      console.warn("Failed to parse persisted cache", e);
    }
  }

  const persist = () => {
    const json = {};
    for (const [k, v] of memoryCache.entries()) {
      v.then(res => {
        json[k] = res;
        localStorage.setItem(storageKey, JSON.stringify(json));
      });
    }
  };

  return async function (...args) {
    const key = JSON.stringify(args[0]);
    if (memoryCache.has(key)) return memoryCache.get(key);
    const result = fn(...args);
    memoryCache.set(key, result);
    persist();
    return result;
  };
}
