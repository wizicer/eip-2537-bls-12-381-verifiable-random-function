import React, { useState } from 'react';
import { DarkTradingViewWithBlocks, BlockChainVisualization, DemoStats } from './components/trading/index';
import { useBlockEngineWithDemo, useBlockOrdersWithDemo, useEpochProgressWithDemo } from './hooks/useBlockEngineWithDemo';

// Mock market data
const mockMarketData = {
  symbol: 'ETH-USD',
  price: 2000.50,
  change: 15.25,
  changePercent: 0.77,
  liquidity: 'high' as const,
  spread: { min: 1999.50, max: 2001.50 }
};

function AppWithBlocks() {
  const [activeTab, setActiveTab] = useState<'trading' | 'blocks'>('trading');
  const { state, visualizations, getHistoricalEpochs, getDemoStats } = useBlockEngineWithDemo();
  const recentOrders = useBlockOrdersWithDemo();
  const epochProgress = useEpochProgressWithDemo();

  const navigation = [
    { id: 'trading', label: 'Trading', icon: '📊' },
    { id: 'blocks', label: 'Block Structure', icon: '⬛' }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#030712', color: '#f3f4f6' }}>
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-100">Dark Pool - Block Trading</h1>
              <span className="px-3 py-1 bg-blue-900/50 text-blue-400 text-xs font-medium rounded-full">
                Privacy-Preserving
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex space-x-1">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    activeTab === item.id
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Bar */}
        <div className="mb-6 bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div>
                <span className="text-sm text-gray-400">Current Epoch</span>
                <div className="text-lg font-semibold text-gray-200">
                  {state.currentEpoch ? `#${state.currentEpoch.index + 1}` : 'Initializing...'}
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-400">Total Orders</span>
                <div className="text-lg font-semibold text-gray-200">
                  {state.orders.size}
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-400">Total Epochs</span>
                <div className="text-lg font-semibold text-gray-200">
                  {state.epochs.size}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                state.matchingProgress.phase === 'matching' ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'
              )} />
              <span className="text-sm text-gray-400">
                {state.matchingProgress.phase === 'matching' ? 'Matching in Progress' : 'System Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'trading' && (
          <div className="space-y-6">
            <DemoStats
              stats={getDemoStats()}
              historicalEpochs={getHistoricalEpochs()}
            />
            <DarkTradingViewWithBlocks marketData={mockMarketData} />
          </div>
        )}

        {activeTab === 'blocks' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-gray-200 mb-4">Block & Epoch Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Block Structure</div>
                  <div className="text-2xl font-bold text-gray-100">5 Blocks</div>
                  <div className="text-xs text-gray-500 mt-1">per Epoch</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Block Duration</div>
                  <div className="text-2xl font-bold text-gray-100">30 sec</div>
                  <div className="text-xs text-gray-500 mt-1">per Block</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Matching</div>
                  <div className="text-2xl font-bold text-gray-100">Random</div>
                  <div className="text-xs text-gray-500 mt-1">Priority within Epoch</div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">How it Works</h3>
                <ol className="text-sm text-gray-400 space-y-2">
                  <li>1. Orders are collected into the current block</li>
                  <li>2. After 30 seconds, a new block is created</li>
                  <li>3. After 5 blocks (2.5 minutes), the epoch is complete</li>
                  <li>4. Orders within the epoch are matched with random priorities</li>
                  <li>5. Completed epochs are processed in chronological order</li>
                </ol>
              </div>
            </div>

            <BlockChainVisualization visualizations={visualizations} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>Dark Pool Trading with Block-based Privacy</div>
            <div>Orders are obfuscated and matched using random priorities</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Helper function for className
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export default AppWithBlocks;