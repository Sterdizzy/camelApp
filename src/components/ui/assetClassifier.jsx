// Asset Classification System
const CRYPTO_TICKERS = new Set([
  'BTC', 'ETH', 'SOL', 'SUI', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'DOGE', 
  'AVAX', 'LINK', 'ONDO', 'WLD', 'CRV', 'BEAM', 'ATH', 'MLC', 'HAT', 
  'KOLIN' 
]);

// New explicit whitelist for ETFs that trade like stocks but have crypto-like symbols
const ETF_FORCE_STOCK = new Set(['ETHU', 'BITX']);

const SYMBOL_ALIASES = {
  'SOLANA': 'SOL',
  'BITCOIN': 'BTC',
  'ETHEREUM': 'ETH',
  'BRKB': 'BRK.B'
};

export function classifyAsset(holding) {
  const rawSymbol = (holding.symbol || '').trim();
  if (!rawSymbol) return null;
  
  let symbol = rawSymbol.toUpperCase();
  
  // Apply symbol aliases
  if (SYMBOL_ALIASES[symbol]) {
    symbol = SYMBOL_ALIASES[symbol];
  }
  
  // 1. Force classification for specific ETFs. This check runs first to override other logic.
  if (ETF_FORCE_STOCK.has(symbol)) {
    console.log(`Asset classifier: ${symbol} forced as stock (ETF)`);
    return { symbol, type: 'stock' };
  }

  // 2. Explicit asset class from data takes next precedence
  if (holding.asset_class === 'crypto') {
    console.log(`Asset classifier: ${symbol} classified as crypto (explicit)`);
    return { symbol, type: 'crypto' };
  }
  if (holding.asset_class === 'equity' || holding.asset_class === 'stock') {
    console.log(`Asset classifier: ${symbol} classified as stock (explicit)`);
    return { symbol, type: 'stock' };
  }
  
  // 3. Check if it's a known crypto ticker from our general whitelist
  if (CRYPTO_TICKERS.has(symbol) || symbol.endsWith('-USD')) {
    console.log(`Asset classifier: ${symbol} classified as crypto (ticker list)`);
    return { 
      symbol: symbol.replace('-USD', ''), 
      type: 'crypto' 
    };
  }
  
  // 4. Check sector-based classification as a fallback
  const sector = (holding.sector || '').toLowerCase();
  if (sector === 'cryptocurrency' || sector === 'crypto' || sector === 'blockchain') {
    console.log(`Asset classifier: ${symbol} classified as crypto (sector)`);
    return { symbol, type: 'crypto' };
  }
  
  // 5. Default to stock if no other rule matches
  console.log(`Asset classifier: ${symbol} defaulted to stock`);
  return { symbol, type: 'stock' };
}

export function normalizeSymbolsForFetch(holdings) {
  const cleanHoldings = holdings.filter(h => (h.symbol || '').trim().length > 0);
  
  if (cleanHoldings.length === 0) {
    return [];
  }
  
  const normalized = cleanHoldings
    .map(h => classifyAsset(h))
    .filter(x => x !== null);
  
  console.log('=== ASSET CLASSIFICATION ===');
  normalized.forEach(item => {
    console.log(`${item.symbol} -> ${item.type}`);
  });
  console.log('============================');
  
  // De-dupe by type+symbol to handle cases where same ticker exists as both stock and crypto
  const unique = new Map();
  for (const item of normalized) {
    const key = `${item.type}:${item.symbol}`;
    unique.set(key, item);
  }
  
  return Array.from(unique.values());
}

export function createPriceKey(type, symbol) {
  return `${type}:${symbol.toUpperCase()}`;
}