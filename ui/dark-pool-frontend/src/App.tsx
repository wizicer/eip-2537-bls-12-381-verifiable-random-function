import React from 'react';

function App() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#030712', color: '#f3f4f6', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Dark Pool Trading Interface</h1>
      <p style={{ marginBottom: '20px' }}>Privacy-Preserving Trading Platform</p>

      <div style={{
        padding: '20px',
        backgroundColor: '#1f2937',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>Features</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '8px' }}>✅ Anonymous Identity Creation</li>
          <li style={{ marginBottom: '8px' }}>✅ Privacy-Preserving Trading</li>
          <li style={{ marginBottom: '8px' }}>✅ Hardware Wallet Integration</li>
          <li style={{ marginBottom: '8px' }}>✅ ZK-Proof Compliance</li>
          <li style={{ marginBottom: '8px' }}>✅ Obfuscated Balances</li>
        </ul>
      </div>

      <div style={{
        padding: '20px',
        backgroundColor: '#374151',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Connect Wallet to Begin</h3>
        <button style={{
          padding: '10px 20px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}>
          Connect Wallet
        </button>
      </div>
    </div>
  );
}

export default App;