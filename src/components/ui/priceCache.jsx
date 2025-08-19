// Enhanced Price Cache Management System with Background Refresh Support
class PriceCache {
  constructor() {
    this.cache = new Map();
    this.shortCache = new Map(); // Short-lived cache for immediate requests
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for fresh data
    this.STALE_DURATION = 15 * 60 * 1000; // 15 minutes before considering stale
    this.SHORT_TTL = 30 * 1000; // 30 seconds for short cache
    this.backgroundRefreshPromise = null; // Track ongoing background refresh
    this.lastManualRefresh = 0; // Track when user manually refreshed
  }

  set(symbol, price, timestamp = Date.now(), source = 'live') {
    const priceData = {
      price: parseFloat(price),
      timestamp,
      source,
      backgroundRefresh: false
    };
    
    this.cache.set(symbol, priceData);
    this.shortCache.set(symbol, { ...priceData, ts: timestamp });
    
    // Persist to localStorage for cross-session caching
    this.persistToStorage();
  }

  // Enhanced method to set multiple prices at once (for batch updates)
  setBatch(pricesMap, timestamp = Date.now(), source = 'live') {
    Object.entries(pricesMap).forEach(([symbol, price]) => {
      if (price !== null && price !== undefined && !isNaN(price)) {
        this.set(symbol, price, timestamp, source);
      }
    });
  }

  getCached(symbol) {
    const hit = this.shortCache.get(symbol);
    if (hit && (Date.now() - hit.ts) < this.SHORT_TTL) {
      return hit.price;
    }
    return null;
  }

  putCached(symbol, price) {
    this.shortCache.set(symbol, { 
      price: parseFloat(price), 
      ts: Date.now(),
      source: 'cache'
    });
  }

  get(symbol) {
    return this.cache.get(symbol);
  }

  getLatest(symbol) {
    const cached = this.cache.get(symbol);
    if (!cached) return null;

    const now = Date.now();
    const age = now - cached.timestamp;
    const timeSinceManualRefresh = now - this.lastManualRefresh;

    return {
      ...cached,
      age,
      isFresh: age < this.CACHE_DURATION,
      isStale: age > this.STALE_DURATION,
      status: this.getStatus(age, timeSinceManualRefresh),
      needsBackgroundRefresh: this.needsBackgroundRefresh(age, timeSinceManualRefresh)
    };
  }

  getStatus(age, timeSinceManualRefresh) {
    // If manually refreshed in last 15 minutes, extend fresh period
    if (timeSinceManualRefresh < this.STALE_DURATION) {
      if (age < this.STALE_DURATION) return 'fresh';
    } else {
      if (age < this.CACHE_DURATION) return 'fresh';
    }
    
    if (age < this.STALE_DURATION) return 'recent';
    return 'stale';
  }

  needsBackgroundRefresh(age, timeSinceManualRefresh) {
    // Don't refresh if manually refreshed recently
    if (timeSinceManualRefresh < this.STALE_DURATION) {
      return false;
    }
    
    // Refresh if data is older than 5 minutes
    return age > this.CACHE_DURATION;
  }

  markManualRefresh() {
    this.lastManualRefresh = Date.now();
  }

  persistToStorage() {
    try {
      const cacheData = Object.fromEntries(this.cache);
      const metadata = {
        lastManualRefresh: this.lastManualRefresh,
        timestamp: Date.now()
      };
      localStorage.setItem('priceCache', JSON.stringify(cacheData));
      localStorage.setItem('priceCacheMetadata', JSON.stringify(metadata));
    } catch (e) {
      console.warn('Failed to persist price cache:', e);
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('priceCache');
      const metadata = localStorage.getItem('priceCacheMetadata');
      
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(Object.entries(data));
      }
      
      if (metadata) {
        const meta = JSON.parse(metadata);
        this.lastManualRefresh = meta.lastManualRefresh || 0;
      }
    } catch (e) {
      console.warn('Failed to load price cache:', e);
    }
  }

  clear() {
    this.cache.clear();
    this.shortCache.clear();
    this.lastManualRefresh = 0;
    localStorage.removeItem('priceCache');
    localStorage.removeItem('priceCacheMetadata');
  }

  getAllPrices() {
    return Array.from(this.cache.entries()).map(([symbol, data]) => ({
      symbol,
      ...this.getLatest(symbol)
    }));
  }

  // Get symbols that need background refresh
  getSymbolsNeedingRefresh() {
    return Array.from(this.cache.entries())
      .filter(([symbol, data]) => {
        const latest = this.getLatest(symbol);
        return latest && latest.needsBackgroundRefresh;
      })
      .map(([symbol]) => symbol);
  }

  // Check if background refresh is in progress
  isBackgroundRefreshInProgress() {
    return this.backgroundRefreshPromise !== null;
  }

  // Set background refresh promise
  setBackgroundRefreshPromise(promise) {
    this.backgroundRefreshPromise = promise;
    if (promise) {
      promise.finally(() => {
        this.backgroundRefreshPromise = null;
      });
    }
  }
}

// Singleton instance
export const priceCache = new PriceCache();

// Initialize on import
priceCache.loadFromStorage();