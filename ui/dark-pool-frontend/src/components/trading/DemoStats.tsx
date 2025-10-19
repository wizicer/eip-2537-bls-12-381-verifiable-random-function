import React from 'react';
import type { Epoch } from '../../types/block';

interface DemoStatsProps {
  stats: {
    totalEpochs: number;
    totalOrders: number;
    totalMatched: number;
    matchRate: string;
  };
  historicalEpochs: Epoch[];
}

export const DemoStats: React.FC<DemoStatsProps> = ({ stats, historicalEpochs }) => {
  return (
    <div className="bg-gray-900 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">{stats.totalOrders}</div>
          <div className="text-xs text-gray-400">Total Orders</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{stats.totalMatched}</div>
          <div className="text-xs text-gray-400">Matched</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.matchRate}%</div>
          <div className="text-xs text-gray-400">Success Rate</div>
        </div>
      </div>
    </div>
  );
};