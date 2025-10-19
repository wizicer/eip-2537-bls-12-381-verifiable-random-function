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
    <div className="bg-gray-900 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">Dark Pool Performance</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.totalEpochs}</div>
          <div className="text-sm text-gray-400">Total Epochs</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{stats.totalOrders}</div>
          <div className="text-sm text-gray-400">Total Orders</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{stats.totalMatched}</div>
          <div className="text-sm text-gray-400">Matched Orders</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-400">{stats.matchRate}%</div>
          <div className="text-sm text-gray-400">Match Rate</div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-200">Recent Epochs</h3>
        <div className="space-y-2">
          {historicalEpochs.slice(-3).reverse().map((epoch, index) => (
            <div key={epoch.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium text-gray-400">Epoch #{epoch.index}</span>
                  <div className="text-xs text-gray-500">
                    {epoch.startedAt.toLocaleTimeString()} - {epoch.completedAt?.toLocaleTimeString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-300">
                    {epoch.matchedOrders} / {epoch.totalOrders} matched
                  </div>
                  <div className="text-xs text-green-400">
                    {((epoch.matchedOrders / epoch.totalOrders) * 100).toFixed(1)}% success
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};