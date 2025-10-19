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

export function useBlockEngineWithDemo() {
  const [state, setState] = useState<MatchingEngineState>(blockEngine.getState());
  const [visualizations, setVisualizations] = useState<EpochVisualization[]>([]);
  const [demoDataLoaded, setDemoDataLoaded] = useState(false);
  const demoDataRef = useRef<ReturnType<typeof generateDemoData> | null>(null);

  useEffect(() => {
    // Load demo data on first mount
    if (!demoDataLoaded) {
      demoDataRef.current = generateDemoData();

      // Add historical epochs to the state
      const currentState = blockEngine.getState();

      // Prepend demo epochs to the existing epochs
      demoDataRef.current.epochs.forEach((epoch, index) => {
        // Adjust the index to continue from existing epochs
        epoch.index = currentState.epochs.size + index;

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