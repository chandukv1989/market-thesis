/**
 * Shared Baseline Prices & Types for Indian Market Providers (FYERS / TrueData)
 */

export const INDIA_BASELINE_PRICES: Record<
  string,
  { price: number; change: number; changePercent: number; volume: string; marketCap: string; exchange: string }
> = {
  RELIANCE: { price: 2985.40, change: 24.50, changePercent: 0.83, volume: '6.4M', marketCap: '₹20.2T', exchange: 'NSE' },
  HDFCBANK: { price: 1642.80, change: 11.20, changePercent: 0.69, volume: '14.2M', marketCap: '₹12.5T', exchange: 'NSE' },
  ICICIBANK: { price: 1224.50, change: 8.75, changePercent: 0.72, volume: '11.8M', marketCap: '₹8.6T', exchange: 'NSE' },
  TCS: { price: 4210.00, change: -18.40, changePercent: -0.44, volume: '2.1M', marketCap: '₹15.2T', exchange: 'NSE' },
  INFY: { price: 1845.20, change: 14.80, changePercent: 0.81, volume: '5.8M', marketCap: '₹7.6T', exchange: 'NSE' },
  BHARTIARTL: { price: 1540.60, change: 16.20, changePercent: 1.06, volume: '4.9M', marketCap: '₹9.1T', exchange: 'NSE' },
  LT: { price: 3680.00, change: -12.50, changePercent: -0.34, volume: '1.8M', marketCap: '₹5.1T', exchange: 'NSE' },
  HCLTECH: { price: 1765.40, change: 9.30, changePercent: 0.53, volume: '2.4M', marketCap: '₹4.8T', exchange: 'NSE' },
  WIPRO: { price: 532.10, change: 3.40, changePercent: 0.64, volume: '7.2M', marketCap: '₹2.8T', exchange: 'NSE' },
  SBIN: { price: 815.70, change: 5.90, changePercent: 0.73, volume: '16.4M', marketCap: '₹7.3T', exchange: 'NSE' },
  KOTAKBANK: { price: 1795.00, change: -6.40, changePercent: -0.36, volume: '3.1M', marketCap: '₹3.6T', exchange: 'NSE' },
  ITC: { price: 502.40, change: 2.10, changePercent: 0.42, volume: '12.1M', marketCap: '₹6.3T', exchange: 'NSE' },
  TATAMOTORS: { price: 980.50, change: 14.20, changePercent: 1.47, volume: '10.5M', marketCap: '₹3.6T', exchange: 'NSE' },
  HINDUNILVR: { price: 2740.00, change: -8.50, changePercent: -0.31, volume: '1.9M', marketCap: '₹6.4T', exchange: 'NSE' }
};

export type CustomFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
