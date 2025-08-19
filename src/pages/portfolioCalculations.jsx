
import { Portfolio, Transaction } from "@/api/entities";
import { livePrices } from "@/api/functions";
import { priceCache } from '@/components/ui/priceCache';
import { classifyAsset, normalizeSymbolsForFetch, createPriceKey } from '@/components/ui/assetClassifier';
import { withRetry, fetchInChunks } from '@/components/ui/priceRetry';

// Background refresh management
let backgroundRefreshInterval = null;

export function calculateHoldingsFromTransactions(transactions) {
  if (!transactions || transactions.length === 0) {
    return [];
  }
  
  const positions = {};
  
  // Sort transactions by date (oldest first) to process them in chronological order
  const sortedTransactions = [...transactions].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
  
  console.log('=== HOLDINGS CALCULATION START ===');
  
  for (const tx of sortedTransactions) {
    const positionKey = `${tx.portfolio_id}-${tx.symbol}`;
    
    console.log(`Processing: ${tx.transaction_date} ${tx.symbol} ${tx.type} ${tx.quantity} @ $${tx.price}`);
    
    if (!positions[positionKey]) {
      positions[positionKey] = {
        symbol: tx.symbol,
        name: tx.name,
        sector: tx.sector,
        portfolio_id: tx.portfolio_id,
        quantity: 0,
        total_cost: 0,
        weighted_avg_price: 0,
        stop_loss: null,
        purchase_dates: [],
        transactions: [],
      };
    }
    
    const pos = positions[positionKey];
    pos.transactions.push(tx);
    
    const txQuantity = parseFloat(tx.quantity) || 0;
    const txPrice = parseFloat(tx.price) || 0;
    
    if (tx.type === 'buy') {
      const buyCost = txQuantity * txPrice;
      
      pos.quantity += txQuantity;
      pos.total_cost += buyCost;
      pos.weighted_avg_price = pos.quantity > 0 ? pos.total_cost / pos.quantity : 0;
      pos.purchase_dates.push(tx.transaction_date);
      
      console.log(`  After BUY: quantity=${pos.quantity}, cost=${pos.total_cost}, avg=${pos.weighted_avg_price}`);
      
      if (tx.stop_loss_at_trade && parseFloat(tx.stop_loss_at_trade) > 0) {
        pos.stop_loss = parseFloat(tx.stop_loss_at_trade);
      }
      
    } else if (tx.type === 'sell') {
      console.log(`  SELLING ${txQuantity} shares from position of ${pos.quantity} shares`);
      
      if (pos.quantity >= txQuantity) {
        // Calculate the average cost per share before the sale
        const avgCostPerShare = pos.weighted_avg_price;
        
        // Reduce the cost basis proportionally
        const costReduction = txQuantity * avgCostPerShare;
        
        pos.total_cost = Math.max(0, pos.total_cost - costReduction);
        pos.quantity = pos.quantity - txQuantity;
        
        // Recalculate weighted average price
        pos.weighted_avg_price = pos.quantity > 0 ? pos.total_cost / pos.quantity : 0;
        
        console.log(`  After SELL: quantity=${pos.quantity}, cost=${pos.total_cost}, avg=${pos.weighted_avg_price}`);
      } else {
        console.error(`ERROR: Cannot sell ${txQuantity} shares, only ${pos.quantity} available!`);
        // Still process the sell to avoid negative quantities
        pos.quantity = 0;
        pos.total_cost = 0;
        pos.weighted_avg_price = 0;
      }
    }
    
    // Always update name and sector to the latest transaction values
    pos.name = tx.name;
    pos.sector = tx.sector;
  }
  
  // Only return positions with shares > 0
  const activePositions = Object.values(positions)
    .filter((p) => {
      const hasActivePosition = p.quantity > 0.0001; // Small threshold for floating point
      console.log(`${p.symbol}: ${p.quantity} shares -> ${hasActivePosition ? 'ACTIVE' : 'CLOSED'}`);
      return hasActivePosition;
    })
    .map((p) => ({
      id: `${p.portfolio_id}-${p.symbol}`,
      symbol: p.symbol,
      name: p.name,
      sector: p.sector,
      portfolio_id: p.portfolio_id,
      quantity: p.quantity,
      purchase_price: p.weighted_avg_price,
      current_price: p.weighted_avg_price,
      total_cost: p.total_cost,
      stop_loss: p.stop_loss || 0,
      purchase_date: p.purchase_dates[0],
      last_price_update: new Date().toISOString(),
      transactions: p.transactions,
    }));
  
  console.log('=== FINAL ACTIVE POSITIONS ===');
  console.log(`Found ${activePositions.length} active positions`);
  activePositions.forEach(pos => {
    console.log(`${pos.symbol}: ${pos.quantity} shares @ avg $${pos.purchase_price.toFixed(2)}`);
  });
  console.log('==============================');
  
  return activePositions;
}

export function calculateRiskMetrics(portfolios, holdings, totalPortfolioValue) {
  console.log('=== RISK METRICS CALCULATION START ===');
  console.log(`Total portfolios: ${portfolios.length}`);
  console.log(`Total holdings: ${holdings.length}`);
  
  const tradingPortfolios = portfolios.filter(p => p.type === 'trading');
  const tradingPortfolioIds = new Set(tradingPortfolios.map(p => p.id));
  
  console.log(`Trading portfolios: ${tradingPortfolios.length}`, tradingPortfolios.map(p => `${p.name} (${p.id})`));
  console.log(`Trading portfolio IDs:`, Array.from(tradingPortfolioIds));
  
  const tradingHoldings = holdings.filter(h => tradingPortfolioIds.has(h.portfolio_id));
  console.log(`Trading holdings: ${tradingHoldings.length}`);
  tradingHoldings.forEach(h => {
    console.log(`  - ${h.symbol} (${h.sector}) in portfolio ${h.portfolio_id}: ${h.quantity} shares`);
  });

  // ALL trading holdings get risk calculated - either stop loss based or full position value
  const individualRisks = tradingHoldings.map(holding => {
    const hasStopLoss = holding.stop_loss && holding.stop_loss > 0;
    let riskAmount;
    
    if (hasStopLoss) {
      // With stop loss: risk is the difference between purchase price and stop loss
      riskAmount = Math.abs(holding.purchase_price - holding.stop_loss) * holding.quantity;
    } else {
      // Without stop loss: ENTIRE position value is at risk
      riskAmount = holding.purchase_price * holding.quantity;
    }
    
    const riskPercentage = totalPortfolioValue > 0 ? (riskAmount / totalPortfolioValue) * 100 : 0;
    
    console.log(`Risk for ${holding.symbol}: $${riskAmount} (${riskPercentage.toFixed(2)}%) - ${hasStopLoss ? 'with stop loss' : 'NO STOP LOSS - FULL POSITION AT RISK'}`);
    
    return { 
      ...holding, 
      risk_amount: riskAmount, 
      risk_percentage: riskPercentage, 
      has_stop_loss: hasStopLoss, 
      exceeds_individual_limit: riskPercentage > 2, 
      risk_status: riskPercentage > 2 ? 'high' : riskPercentage > 1.5 ? 'medium' : 'low' 
    };
  });

  // Group by sector for sector risk analysis
  const sectorRisks = {};
  individualRisks.forEach(holding => {
    const sector = holding.sector || 'Unknown';
    if (!sectorRisks[sector]) {
      sectorRisks[sector] = { 
        sector_name: sector, 
        total_risk_amount: 0, 
        total_risk_percentage: 0, 
        holdings_count: 0, 
        holdings: [],
        portfolio_ids: new Set()
      };
    }
    sectorRisks[sector].total_risk_amount += holding.risk_amount;
    sectorRisks[sector].holdings_count += 1;
    sectorRisks[sector].holdings.push(holding);
    sectorRisks[sector].portfolio_ids.add(holding.portfolio_id);
  });

  // Calculate sector percentages and compliance
  Object.values(sectorRisks).forEach((sector) => {
    sector.total_risk_percentage = totalPortfolioValue > 0 ? (sector.total_risk_amount / totalPortfolioValue) * 100 : 0;
    sector.exceeds_sector_limit = sector.total_risk_percentage > 6;
    sector.risk_status = sector.total_risk_percentage > 6 ? 'high' : sector.total_risk_percentage > 4.5 ? 'medium' : 'low';
    
    // Convert Set to Array for easier access
    sector.portfolio_ids = Array.from(sector.portfolio_ids);
    
    console.log(`Sector ${sector.sector_name}: ${sector.holdings_count} positions, $${sector.total_risk_amount} (${sector.total_risk_percentage.toFixed(2)}%)`);
    console.log(`  Holdings: ${sector.holdings.map(h => h.symbol).join(', ')}`);
    console.log(`  Portfolios: ${sector.portfolio_ids.join(', ')}`);
  });

  const totalRiskAmount = individualRisks.reduce((sum, holding) => sum + holding.risk_amount, 0);
  const totalRiskPercentage = totalPortfolioValue > 0 ? (totalRiskAmount / totalPortfolioValue) * 100 : 0;
  const holdingsWithRiskViolations = individualRisks.filter(h => h.exceeds_individual_limit);
  const sectorsWithRiskViolations = Object.values(sectorRisks).filter((s) => s.exceeds_sector_limit);

  console.log('=== RISK METRICS SUMMARY ===');
  console.log(`Total risk: $${totalRiskAmount} (${totalRiskPercentage.toFixed(2)}%)`);
  console.log(`Individual violations: ${holdingsWithRiskViolations.length}`);
  console.log(`Sector violations: ${sectorsWithRiskViolations.length}`);
  console.log('============================');

  return {
    individual_risks: individualRisks, 
    sector_risks: Object.values(sectorRisks), 
    total_risk_amount: totalRiskAmount, 
    total_risk_percentage: totalRiskPercentage,
    holdings_with_violations: holdingsWithRiskViolations, 
    sectors_with_violations: sectorsWithRiskViolations,
    compliance_status: { 
      individual_compliance: holdingsWithRiskViolations.length === 0, 
      sector_compliance: sectorsWithRiskViolations.length === 0, 
      overall_compliance: holdingsWithRiskViolations.length === 0 && sectorsWithRiskViolations.length === 0 
    }
  };
}

export function validateTransactionRisk(proposedTransaction, portfolios, holdings, totalPortfolioValue, preCalculatedRiskMetrics) {
    const portfolio = portfolios.find(p => p.id === proposedTransaction.portfolio_id);
    if (!portfolio || portfolio.type !== 'trading') return { is_valid: true, validation_type: 'not_applicable', message: 'Risk rules do not apply to long-term portfolios' };
    if (proposedTransaction.type !== 'buy') return { is_valid: true, validation_type: 'not_applicable', message: 'Risk validation only applies to buy transactions' };
    const quantity = parseFloat(proposedTransaction.quantity) || 0;
    const price = parseFloat(proposedTransaction.price) || 0;
    const stopLoss = parseFloat(proposedTransaction.stop_loss_at_trade) || 0;
    const sector = proposedTransaction.sector;
    let proposedRiskAmount = stopLoss > 0 ? Math.abs(price - stopLoss) * quantity : price * quantity;
    const proposedRiskPercentage = totalPortfolioValue > 0 ? (proposedRiskAmount / totalPortfolioValue) * 100 : 0;
    const stopLossMessageSuffix = stopLoss > 0 ? '' : ' (no stop-loss = full investment at risk)';
    if (proposedRiskPercentage > 2) return { is_valid: false, validation_type: 'individual_limit_exceeded', risk_amount: proposedRiskAmount, risk_percentage: proposedRiskPercentage, limit_percentage: 2, message: `Individual investment risk (${proposedRiskPercentage.toFixed(2)}%) exceeds 2% limit${stopLossMessageSuffix}` };
    const currentSectorRisk = preCalculatedRiskMetrics?.sector_risks?.find((s) => s.sector_name === sector);
    const currentSectorRiskAmount = currentSectorRisk ? currentSectorRisk.total_risk_amount : 0;
    const proposedSectorRiskAmount = currentSectorRiskAmount + proposedRiskAmount;
    const proposedSectorRiskPercentage = totalPortfolioValue > 0 ? (proposedSectorRiskAmount / totalPortfolioValue) * 100 : 0;
    if (proposedSectorRiskPercentage > 6) return { is_valid: false, validation_type: 'sector_limit_exceeded', risk_amount: proposedRiskAmount, risk_percentage: proposedRiskPercentage, sector_risk_amount: proposedSectorRiskAmount, sector_risk_percentage: proposedSectorRiskPercentage, limit_percentage: 6, message: `Sector risk (${proposedSectorRiskPercentage.toFixed(2)}%) would exceed 6% limit${stopLossMessageSuffix}` };
    if (!stopLoss || stopLoss <= 0) return { is_valid: true, validation_type: 'no_stop_loss', risk_amount: proposedRiskAmount, risk_percentage: proposedRiskPercentage, sector_risk_amount: proposedSectorRiskAmount, sector_risk_percentage: proposedSectorRiskPercentage, message: `No stop loss specified - full investment at risk` };
    return { is_valid: true, validation_type: 'compliant', risk_amount: proposedRiskAmount, risk_percentage: proposedRiskPercentage, sector_risk_amount: proposedSectorRiskAmount, sector_risk_percentage: proposedSectorRiskPercentage, message: `Transaction complies with risk rules${stopLossMessageSuffix}` };
}

// Enhanced background refresh management
export function startBackgroundPriceRefresh() {
  // Clear any existing interval
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
  }
  
  // Set up background refresh every 5 minutes
  backgroundRefreshInterval = setInterval(async () => {
    try {
      await refreshStaleData();
    } catch (error) {
      console.warn('Background price refresh failed:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

export function stopBackgroundPriceRefresh() {
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
    backgroundRefreshInterval = null;
  }
}

// Function to refresh stale data in background
async function refreshStaleData() {
  if (priceCache.isBackgroundRefreshInProgress()) {
    console.log('Background refresh already in progress, skipping');
    return;
  }

  const symbolsNeedingRefresh = priceCache.getSymbolsNeedingRefresh();
  if (symbolsNeedingRefresh.length === 0) {
    console.log('No symbols need background refresh');
    return;
  }

  console.log(`Starting background refresh for ${symbolsNeedingRefresh.length} symbols`);
  
  try {
    // Get current holdings to determine asset types
    const [portfolioData, transactionData] = await Promise.all([Portfolio.list(), Transaction.list()]);
    const holdings = calculateHoldingsFromTransactions(transactionData);
    
    // Filter holdings for symbols that need refresh
    const holdingsNeedingRefresh = holdings.filter(h => 
      symbolsNeedingRefresh.includes(createPriceKey(classifyAsset(h)?.type || 'stock', h.symbol))
    );
    
    if (holdingsNeedingRefresh.length === 0) return;

    const symbolsToFetch = normalizeSymbolsForFetch(holdingsNeedingRefresh);
    
    const refreshPromise = fetchInChunks(symbolsToFetch, 40, livePrices);
    priceCache.setBackgroundRefreshPromise(refreshPromise);
    
    const pricesFromFetch = await refreshPromise;
    
    if (pricesFromFetch) {
      priceCache.setBatch(pricesFromFetch, Date.now(), 'background');
      console.log(`Background refresh completed for ${Object.keys(pricesFromFetch).length} symbols`);
    }
  } catch (error) {
    console.warn('Background refresh failed:', error);
  }
}

// Enhanced main calculation function with better error handling and debugging
export async function calculateTotalPortfolioValue(signal = null, forceRefresh = false) {
  try {
    console.log('=== PORTFOLIO CALCULATION START ===');
    console.log('Force refresh:', forceRefresh);
    
    const [portfolioData, transactionData] = await Promise.all([
      Portfolio.list(), 
      Transaction.list()
    ]);
    const holdings = calculateHoldingsFromTransactions(transactionData);
    const totalCashBalance = portfolioData.reduce((sum, p) => sum + (p.cash_balance || 0), 0);
    
    console.log(`Found ${holdings.length} holdings from ${transactionData.length} transactions`);
    
    if (holdings.length === 0) {
      return {
        totalValue: totalCashBalance, totalHoldingsValue: 0, totalCostBasis: 0, totalUnrealizedPL: 0, totalUnrealizedPLPercent: 0,
        totalCashBalance, portfolios: portfolioData, holdings: [], transactions: transactionData,
        risk_metrics: calculateRiskMetrics(portfolioData, [], totalCashBalance)
      };
    }

    const symbolsToFetch = normalizeSymbolsForFetch(holdings);
    console.log('Symbols to fetch:', symbolsToFetch);
    
    // Enhanced caching strategy
    const pricesFromCache = {};
    const symbolsNeedingFetch = [];
    
    symbolsToFetch.forEach(({ symbol, type }) => {
      const key = createPriceKey(type, symbol);
      const cachedPrice = priceCache.getLatest(key);
      
      if (cachedPrice && (cachedPrice.isFresh || (!forceRefresh && !cachedPrice.needsBackgroundRefresh))) {
        // Use cached price if fresh, or if we're not forcing refresh and it doesn't need background refresh
        pricesFromCache[key] = {
          price: cachedPrice.price,
          status: cachedPrice.status,
          timestamp: cachedPrice.timestamp
        };
        console.log(`Using cached price for ${key}: $${cachedPrice.price} (${cachedPrice.status})`);
      } else {
        // Need to fetch fresh data
        symbolsNeedingFetch.push({ symbol, type });
        console.log(`Need fresh price for ${key}`);
      }
    });

    let pricesFromFetch = {};
    let fetchStatus = 'success';
    
    if (symbolsNeedingFetch.length > 0) {
      try {
        console.log(`Fetching fresh prices for ${symbolsNeedingFetch.length} symbols`);
        
        const fetchPromise = Promise.race([
          fetchInChunks(symbolsNeedingFetch, 40, livePrices),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Price fetch timeout')), 15000))
        ]);
        
        if (signal) {
          // Handle abort signal
          signal.addEventListener('abort', () => {
            fetchStatus = 'aborted';
          });
        }
        
        const fetchResult = await fetchPromise;
        console.log('Fetch result:', fetchResult);
        
        if (fetchResult) {
          pricesFromFetch = fetchResult;
          priceCache.setBatch(pricesFromFetch, Date.now(), 'live');
          if (forceRefresh) {
            priceCache.markManualRefresh();
          }
        }
      } catch (error) {
        console.warn('Live price fetch failed, using cached data:', error);
        fetchStatus = 'failed';
        
        // Fall back to any available cached data for symbols we couldn't fetch
        symbolsNeedingFetch.forEach(({ symbol, type }) => {
          const key = createPriceKey(type, symbol);
          const cachedPrice = priceCache.getLatest(key);
          if (cachedPrice) {
            pricesFromCache[key] = {
              price: cachedPrice.price,
              status: 'stale',
              timestamp: cachedPrice.timestamp
            };
            console.log(`Fallback to cached price for ${key}: $${cachedPrice.price}`);
          }
        });
      }
    }
    
    // Merge all price data
    const allPrices = { ...pricesFromCache };
    Object.entries(pricesFromFetch).forEach(([key, price]) => {
      allPrices[key] = {
        price,
        status: 'fresh',
        timestamp: Date.now()
      };
    });

    console.log('All prices available:', Object.keys(allPrices));

    const updatedHoldings = holdings.map(holding => {
      const classified = classifyAsset(holding);
      let currentPrice = holding.purchase_price;
      let priceStatus = 'fallback_purchase';
      let lastUpdate = null;

      if (classified) {
        const priceKey = createPriceKey(classified.type, classified.symbol);
        const priceData = allPrices[priceKey];
        
        console.log(`Price lookup for ${holding.symbol}: key=${priceKey}, found=${!!priceData}`);
        
        if (priceData) {
          currentPrice = priceData.price;
          priceStatus = priceData.status;
          lastUpdate = new Date(priceData.timestamp).toISOString();
          console.log(`Updated ${holding.symbol}: $${currentPrice} (${priceStatus})`);
        } else {
          console.log(`No price found for ${holding.symbol}, using purchase price: $${currentPrice}`);
        }
      }

      const totalValue = currentPrice * holding.quantity;
      const unrealizedPL = totalValue - holding.total_cost;
      const unrealizedPLPercent = holding.total_cost > 0 ? (unrealizedPL / holding.total_cost) * 100 : 0;
      
      return {
        ...holding, 
        current_price: currentPrice, 
        price_status: priceStatus, 
        last_price_update: lastUpdate,
        total_value: totalValue, 
        unrealized_pl: unrealizedPL, 
        unrealized_pl_percent: unrealizedPLPercent,
      };
    });
    
    const totalHoldingsValue = updatedHoldings.reduce((sum, h) => sum + h.total_value, 0);
    const totalCostBasis = updatedHoldings.reduce((sum, h) => sum + h.total_cost, 0);
    const totalUnrealizedPL = totalHoldingsValue - totalCostBasis;
    const totalUnrealizedPLPercent = totalCostBasis > 0 ? (totalUnrealizedPL / totalCostBasis) * 100 : 0;
    const totalValue = totalHoldingsValue + totalCashBalance;
    
    console.log('=== PORTFOLIO CALCULATION COMPLETE ===');
    console.log(`Total value: $${totalValue}`);
    console.log(`Fetch status: ${fetchStatus}`);
    console.log('=======================================');
    
    return {
      totalValue, totalHoldingsValue, totalCostBasis, totalUnrealizedPL, totalUnrealizedPLPercent, totalCashBalance,
      portfolios: portfolioData, holdings: updatedHoldings, transactions: transactionData,
      risk_metrics: calculateRiskMetrics(portfolioData, updatedHoldings, totalValue),
      pricesFetchStatus: fetchStatus
    };
    
  } catch (error) {
    console.error("Critical error in calculateTotalPortfolioValue:", error);
    return {
      totalValue: 0, totalHoldingsValue: 0, totalCostBasis: 0, totalUnrealizedPL: 0, totalUnrealizedPLPercent: 0,
      totalCashBalance: 0, portfolios: [], holdings: [], transactions: [],
      risk_metrics: { individual_risks: [], sector_risks: [], total_risk_amount: 0, total_risk_percentage: 0, holdings_with_violations: [], sectors_with_violations: [], compliance_status: { individual_compliance: true, sector_compliance: true, overall_compliance: true }},
      pricesFetchStatus: 'error'
    };
  }
}
