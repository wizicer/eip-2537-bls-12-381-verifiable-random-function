import { useEffect, useState, useCallback, useRef } from 'react';
import { blockEngine } from '../services/blockEngine';
import { preloadDemoData, generateDemoData } from '../test/demoDataGenerator';
import type {
  MatchingEngineState,
  EpochVisualization,
  Order,
  BlockMatchingConfig,
  Epoch
} from '../types/block';

export function useBlockEngineWithDemo(config?: {
  demoMode?: 'static' | 'dynamic';
  speed?: 'normal' | 'fast' | 'ultra-fast';
}) {
  const { demoMode = 'dynamic', speed = 'fast' } = config || {};

  const [state, setState] = useState<MatchingEngineState>(blockEngine.getState());
  const [visualizations, setVisualizations] = useState<EpochVisualization[]>([]);
  const [demoDataLoaded, setDemoDataLoaded] = useState(false);
  const demoDataRef = useRef<ReturnType<typeof generateDemoData> | null>(null);

  useEffect(() => {
    // Configure block engine for demo mode
    if (demoMode === 'dynamic') {
      // Speed configurations for demo
      const speedConfig = {
        normal: { BLOCK_DURATION: 5000, EPOCH_MATCHING_DELAY: 1000 }, // 5s per block
        fast: { BLOCK_DURATION: 2000, EPOCH_MATCHING_DELAY: 500 },   // 2s per block
        'ultra-fast': { BLOCK_DURATION: 1000, EPOCH_MATCHING_DELAY: 200 } // 1s per block
      };

      // Reconfigure the block engine with demo speed
      blockEngine.updateConfig(speedConfig[speed]);
    }

    // Load demo data on first mount
    if (!demoDataLoaded) {
      // For dynamic mode, generate fewer historical epochs to save memory
      const numHistoricalEpochs = demoMode === 'dynamic' ? 50 : 5673;
      demoDataRef.current = generateDemoData(numHistoricalEpochs);

      // Add historical epochs to the state
      const currentState = blockEngine.getState();

      // Add demo epochs to the state
      // Demo epochs already have correct indices (0 to numEpochs-1)
      // They represent historical data, so they should come before any real-time epochs
      demoDataRef.current.epochs.forEach(epoch => {
        // Add epoch to state
        currentState.epochs.set(epoch.id, epoch);

        // Add blocks to state
        epoch.blocks.forEach(block => {
          currentState.blocks.set(block.id, block);
        });

        // Add orders to state
        epoch.blocks.forEach(block => {
          block.orders.forEach(order => {
            currentState.orders.set(order.id, order);
          });
        });
      });

      // Preload current orders
      preloadDemoData(blockEngine);

      // Start the engine for dynamic mode
      if (demoMode === 'dynamic') {
        // Start the block engine to begin generating new epochs
        blockEngine.start();
      }

      setDemoDataLoaded(true);
    }

    // Subscribe to block engine updates
    const unsubscribe = blockEngine.subscribe((newState) => {
      setState(newState);
      setVisualizations(blockEngine.getVisualizationData());
    });

    // Initial visualization data
    setVisualizations(blockEngine.getVisualizationData());

    return unsubscribe;
  }, [demoDataLoaded]);

  const addOrder = useCallback((orderData: Omit<Order, 'id' | 'status' | 'createdAt' | 'blockId' | 'epochId'>) => {
    return blockEngine.addOrder(orderData);
  }, []);

  const getState = useCallback(() => {
    return blockEngine.getState();
  }, []);

  const getVisualizationData = useCallback(() => {
    return blockEngine.getVisualizationData();
  }, []);

  const getHistoricalEpochs = useCallback(() => {
    return demoDataRef.current?.epochs || [];
  }, []);

  const getDemoStats = useCallback(() => {
    if (!demoDataRef.current) {
      return {
        totalEpochs: 0,
        totalOrders: 0,
        totalMatched: 0,
        matchRate: '0'
      };
    }

    const { epochs } = demoDataRef.current;
    const totalOrders = epochs.reduce((sum, epoch) => sum + epoch.totalOrders, 0);
    const totalMatched = epochs.reduce((sum, epoch) => sum + epoch.matchedOrders, 0);

    return {
      totalEpochs: epochs.length,
      totalOrders,
      totalMatched,
      matchRate: totalOrders > 0 ? (totalMatched / totalOrders * 100).toFixed(1) : '0'
    };
  }, []);

  return {
    state,
    visualizations,
    addOrder,
    getState,
    getVisualizationData,
    getHistoricalEpochs,
    getDemoStats,
    demoDataLoaded
  };
}

// Enhanced hook for order management with demo data
export function useBlockOrdersWithDemo(symbol?: string) {
  const { state, getHistoricalEpochs } = useBlockEngineWithDemo();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let allOrders: Order[] = [];

    // Get current orders from engine
    allOrders = Array.from(state.orders.values());

    // Add historical orders
    const historicalEpochs = getHistoricalEpochs();
    historicalEpochs.forEach(epoch => {
      epoch.blocks.forEach(block => {
        allOrders.push(...block.orders);
      });
    });

    // Filter by symbol if provided
    if (symbol) {
      allOrders = allOrders.filter(order => order.symbol === symbol);
    }

    // Sort by creation time (newest first)
    allOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Take only the most recent 20 orders for display
    setOrders(allOrders.slice(0, 20));
  }, [state.orders, symbol, getHistoricalEpochs]);

  return orders;
}

// Enhanced hook for epoch progress with demo data
export function useEpochProgressWithDemo() {
  const { state, getHistoricalEpochs } = useBlockEngineWithDemo();
  const [progress, setProgress] = useState({
    currentBlock: 0,
    totalBlocks: 5,
    epochProgress: 0,
    matchingProgress: 0,
    phase: 'collecting' as 'collecting' | 'matching' | 'idle',
    historicalEpochs: [] as Epoch[]
  });

  useEffect(() => {
    const historicalEpochs = getHistoricalEpochs();

    if (state.currentEpoch) {
      const epoch = state.currentEpoch;
      const currentBlock = epoch.blocks.length;
      const epochProgress = (currentBlock / 5) * 100;

      setProgress({
        currentBlock,
        totalBlocks: 5,
        epochProgress,
        matchingProgress: state.matchingProgress.progress,
        phase: state.matchingProgress.phase as 'collecting' | 'matching' | 'idle',
        historicalEpochs
      });
    } else {
      setProgress(prev => ({ ...prev, historicalEpochs }));
    }
  }, [state.currentEpoch, state.matchingProgress, getHistoricalEpochs]);

  return progress;
}