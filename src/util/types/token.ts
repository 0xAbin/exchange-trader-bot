
export type Token = {
    name: string;
    marketType?: string;
    symbol: string;
    assetSymbol?: string;
    baseSymbol?: string;
    decimals: number;
    address: string;
    priceDecimals?: number;
    wrappedAddress?: string;
    coingeckoUrl?: string;
    coingeckoSymbol?: string;
    metamaskSymbol?: string;
    explorerSymbol?: string;
    explorerUrl?: string;
    reservesUrl?: string;
    imageUrl?: string;
  
    isUsdg?: boolean;
    isNative?: boolean;
    isWrapped?: boolean;
    isShortable?: boolean;
    isStable?: boolean;
    isSynthetic?: boolean;
    isTempHidden?: boolean;
    isChartDisabled?: boolean;
    isV1Available?: boolean;
    isPlatformToken?: boolean;
    isPlatformTradingToken?: boolean;
    
  };

export type TokenPrices = {
  minPrice: bigint;
  maxPrice: bigint;
};

export type TokenData = Token & {
  prices: TokenPrices;
  balance?: bigint;
  totalSupply?: bigint;
};

export type TokensRatio = {
  ratio: bigint;
  largestToken: Token;
  smallestToken: Token;
};

export type TokenBalancesData = {
  [tokenAddress: string]: bigint;
};

export type TokenPricesData = {
  [address: string]: TokenPrices;
};

export type TokensAllowanceData = {
  [tokenAddress: string]: bigint;
};

export type TokensData = {
  [address: string]: TokenData;
};

export type SimulationPrices = {
  primaryTokens: string[];
  primaryPrices: TokenPrices[];
};


export type PendingDepositData = {
    account: string;
    marketAddress: string;
    initialLongTokenAddress: string;
    initialShortTokenAddress: string;
    longTokenSwapPath: string[];
    shortTokenSwapPath: string[];
    initialLongTokenAmount: bigint;
    initialShortTokenAmount: bigint;
    minMarketTokens: bigint;
    shouldUnwrapNativeToken: boolean;
  };



