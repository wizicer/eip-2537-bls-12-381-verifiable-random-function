<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useWeb3 } from '../composables/useWeb3'

interface Trade {
  trader: string
  price: bigint
  volume: bigint
  tradeType: number
  blockNumber: bigint
  timestamp: bigint
}

interface EpochGroup {
  epochNumber: number
  startBlock: number
  endBlock: number
  trades: Trade[]
  isExpanded: boolean
}

const web3 = useWeb3()
const trades = ref<Trade[]>([])
const isLoading = ref(false)
const errorMessage = ref('')

const epochGroups = computed(() => {
  if (trades.value.length === 0) return []

  const groups: Map<number, Trade[]> = new Map()

  trades.value.forEach(trade => {
    const blockNum = Number(trade.blockNumber)
    const epochNum = Math.floor(blockNum / 5)
    
    if (!groups.has(epochNum)) {
      groups.set(epochNum, [])
    }
    groups.get(epochNum)!.push(trade)
  })

  const result: EpochGroup[] = Array.from(groups.entries())
    .map(([epochNum, epochTrades]) => ({
      epochNumber: epochNum,
      startBlock: epochNum * 5,
      endBlock: epochNum * 5 + 4,
      trades: epochTrades,
      isExpanded: false
    }))
    .sort((a, b) => b.epochNumber - a.epochNumber)

  return result
})

async function loadTrades() {
  const contract = web3.getContract()
  if (!contract) {
    errorMessage.value = 'Contract not initialized'
    return
  }

  try {
    isLoading.value = true
    errorMessage.value = ''

    const allTrades = await contract.getAllTrades()
    trades.value = allTrades

  } catch (error: any) {
    console.error('Error loading trades:', error)
    errorMessage.value = error.message || 'Failed to load trades'
  } finally {
    isLoading.value = false
  }
}

function toggleEpoch(epochNumber: number) {
  const epoch = epochGroups.value.find(e => e.epochNumber === epochNumber)
  if (epoch) {
    epoch.isExpanded = !epoch.isExpanded
  }
}

function formatAddress(address: string): string {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

function formatTimestamp(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000)
  return date.toLocaleString()
}

onMounted(() => {
  loadTrades()
  
  // Set up event listener for new trades
  const contract = web3.getContract()
  if (contract) {
    contract.on('TradeSubmitted', () => {
      loadTrades()
    })
  }
})
</script>

<template>
  <div class="trade-list">
    <div class="header">
      <h2>Trade History</h2>
      <button @click="loadTrades" :disabled="isLoading" class="refresh-btn">
        {{ isLoading ? 'Loading...' : 'Refresh' }}
      </button>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div v-if="isLoading && trades.length === 0" class="loading">
      Loading trades...
    </div>

    <div v-else-if="epochGroups.length === 0" class="no-trades">
      No trades yet. Submit your first trade!
    </div>

    <div v-else class="epochs">
      <div
        v-for="epoch in epochGroups"
        :key="epoch.epochNumber"
        class="epoch-panel"
      >
        <div class="epoch-header" @click="toggleEpoch(epoch.epochNumber)">
          <div class="epoch-info">
            <span class="epoch-title">Epoch {{ epoch.epochNumber }}</span>
            <span class="epoch-blocks">
              Blocks {{ epoch.startBlock }} - {{ epoch.endBlock }}
            </span>
            <span class="epoch-count">
              {{ epoch.trades.length }} trade{{ epoch.trades.length !== 1 ? 's' : '' }}
            </span>
          </div>
          <span class="toggle-icon">
            {{ epoch.isExpanded ? '▼' : '▶' }}
          </span>
        </div>

        <div v-if="epoch.isExpanded" class="epoch-content">
          <div
            v-for="(trade, index) in epoch.trades"
            :key="index"
            class="trade-item"
            :class="trade.tradeType === 0 ? 'buy' : 'sell'"
          >
            <div class="trade-row">
              <span class="trade-label">Type:</span>
              <span class="trade-value trade-type">
                {{ trade.tradeType === 0 ? 'BUY' : 'SELL' }}
              </span>
            </div>
            <div class="trade-row">
              <span class="trade-label">Price:</span>
              <span class="trade-value">{{ trade.price.toString() }}</span>
            </div>
            <div class="trade-row">
              <span class="trade-label">Volume:</span>
              <span class="trade-value">{{ trade.volume.toString() }}</span>
            </div>
            <div class="trade-row">
              <span class="trade-label">Trader:</span>
              <span class="trade-value">{{ formatAddress(trade.trader) }}</span>
            </div>
            <div class="trade-row">
              <span class="trade-label">Block:</span>
              <span class="trade-value">{{ trade.blockNumber.toString() }}</span>
            </div>
            <div class="trade-row">
              <span class="trade-label">Time:</span>
              <span class="trade-value">{{ formatTimestamp(trade.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trade-list {
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  height: 100%;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h2 {
  margin: 0;
  color: #333;
}

.refresh-btn {
  padding: 8px 16px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.refresh-btn:hover:not(:disabled) {
  background: #1976D2;
}

.refresh-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-message {
  padding: 10px;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 14px;
}

.loading,
.no-trades {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 16px;
}

.epochs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.epoch-panel {
  background: white;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.epoch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #fff;
  cursor: pointer;
  transition: background 0.2s;
}

.epoch-header:hover {
  background: #f9f9f9;
}

.epoch-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.epoch-title {
  font-weight: 600;
  font-size: 16px;
  color: #333;
}

.epoch-blocks {
  font-size: 13px;
  color: #666;
}

.epoch-count {
  font-size: 12px;
  color: #999;
}

.toggle-icon {
  font-size: 12px;
  color: #666;
}

.epoch-content {
  padding: 10px 15px 15px;
  background: #fafafa;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trade-item {
  padding: 12px;
  background: white;
  border-radius: 4px;
  border-left: 4px solid #ccc;
}

.trade-item.buy {
  border-left-color: #4CAF50;
}

.trade-item.sell {
  border-left-color: #f44336;
}

.trade-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 14px;
}

.trade-label {
  color: #666;
  font-weight: 500;
}

.trade-value {
  color: #333;
  font-family: monospace;
}

.trade-type {
  font-weight: 600;
}

.trade-item.buy .trade-type {
  color: #4CAF50;
}

.trade-item.sell .trade-type {
  color: #f44336;
}
</style>
