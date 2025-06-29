import React, { FormEvent, useState } from 'react';
import { BrowserWallet, serializePlutusScript, Transaction, PlutusScript, BlockfrostProvider, MeshTxBuilder, Asset, deserializeAddress } from '@meshsdk/core';
import betContract from '@/scripts/bet.plutus.json';
import { useWallet } from '@meshsdk/react';
import { getBrowserWallet, getScript, getTxBuilder } from '@/utils/common';
import { makeBetDatum } from '@/utils/bet';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

export default function DeployBetForm() {
  const [oracle, setOracle] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [wager, setWager] = useState('1000000');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const wallet = await getBrowserWallet();
    const utxos = await wallet.getUtxos();
    const [walletAddress] = await wallet.getUsedAddresses();

    try {
      // 1) collect & parse
      const lovelace = BigInt(wager);
      const deadline = BigInt(Date.now() + FIVE_MINUTES_MS);

      // 2) build the datum
      const datum = makeBetDatum(
        deserializeAddress(oracle).pubKeyHash,
        lovelace,
        deserializeAddress(player1).pubKeyHash,
        deserializeAddress(player2).pubKeyHash,
        deadline,
        false
      );

      // 3) prepare assets + script
      const assets: Asset[] = [{ unit: "lovelace", quantity: wager }];
      const utxos = await wallet.getUtxos();
      const [addr] = await wallet.getUsedAddresses();
      const { scriptAddr } = getScript();

      // 4) build, sign and submit
      const txBuilder = getTxBuilder()
        .txOut(scriptAddr, assets)
        .txOutDatumHashValue(datum)
        .changeAddress(addr)
        .selectUtxosFrom(utxos);
      await txBuilder.complete();

      const signed = await wallet.signTx(txBuilder.txHex);
      const hash = await wallet.submitTx(signed);

      setTxHash(hash);
    } catch (err: any) {
      console.error(err);
      alert(`Deployment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-md flex flex-col gap-4"
    >
      <h2 className="text-2xl font-semibold text-gray-800">Deploy Bet Contract</h2>

      {/* Oracle PubKey */}
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

      {/* Player 1 Address */}
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

      {/* Player 2 Address */}
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

      {/* Wager */}
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
