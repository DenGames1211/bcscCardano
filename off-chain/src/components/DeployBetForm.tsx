'use client';

import { useState } from 'react';
import { deployBetContract, BetDatum } from '@/utils/lucid';

export default function DeployBetForm() {
  const [oracle, setOracle] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [wager, setWager] = useState('5000000'); // Default 5 ADA
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTxHash(null);

    try {
      const bet: BetDatum = {
        oracle,
        player_1: player1,
        player_2: player2,
        wager: BigInt(wager),
        deadline: BigInt(Date.now() + 3600_000), // +1 ora
        is_joined: false
      };

      const hash = await deployBetContract(bet, bet.wager * 2n);
      setTxHash(hash);
    } catch (err) {
      console.error(err);
      alert('Deploy fallito: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-md flex flex-col gap-4"
    >
      <h2 className="text-2xl font-semibold text-gray-800">Deploy Bet Contract</h2>

      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Oracle PubKey</label>
        <input
          type="text"
          value={oracle}
          onChange={(e) => setOracle(e.target.value)}
          required
          className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Player 1 Address</label>
        <input
          type="text"
          value={player1}
          onChange={(e) => setPlayer1(e.target.value)}
          required
          className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Player 2 Address</label>
        <input
          type="text"
          value={player2}
          onChange={(e) => setPlayer2(e.target.value)}
          required
          className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Wager (in Lovelace)</label>
        <input
          type="number"
          min="1000000"
          step="100000"
          value={wager}
          onChange={(e) => setWager(e.target.value)}
          required
          className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white rounded-xl py-2 font-semibold hover:bg-blue-700 transition duration-200 disabled:opacity-50"
      >
        {loading ? 'Deploying…' : 'Deploy'}
      </button>

      {txHash && (
        <p className="text-green-600 text-sm break-all">
          ✅ TX Hash: <code>{txHash}</code>
        </p>
      )}
    </form>
  );
}
