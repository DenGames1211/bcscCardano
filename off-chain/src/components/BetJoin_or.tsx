'use client';

import React, { FormEvent, useState } from 'react';
import {
  Asset,
  BlockfrostProvider,
  deserializeAddress,
  Transaction,
  resolvePaymentKeyHash,
  MeshWallet,
  MeshTxBuilder,
  signData,
} from '@meshsdk/core';
import {
  getBrowserWallet,
  getScript,
  getTxBuilder,
} from '@/utils/common';
import { makeBetDatum } from '@/utils/bet';

import { useRouter } from "next/navigation";

//const router = useRouter();
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

export default function BetJoin() {
  const [oracle, setOracle] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [wager, setWager] = useState('1000000');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const wallet = await getBrowserWallet();
      const utxos = await wallet.getUtxos();
      const [userAddr] = await wallet.getUsedAddresses();

      //0.5 walltet di p2 (mnemonic)
      const p2wallet = new MeshWallet({
        networkId: 0, // 0: testnet, 1: mainnet
        fetcher: provider,
        submitter: provider,
        key: {
            type: 'mnemonic',
            words: ["perfect", "pass", "you", "fly", "auto", "soldier", "sauce", "stuff", "reduce", "finish", "carbon", "clerk", "tent", "expect", "surge", "wolf", "busy", "section", "sweet", "brisk", "dove", "seven", "taxi", "kidney"],
        },
        });

        await p2wallet.init()
    
      const p2address = p2wallet.getChangeAddress();
      // 1. Calcola i valori
      const lovelace = BigInt(wager);
      const deadline = BigInt(Date.now() + FIVE_MINUTES_MS);

      // 2. Decodifica address e ottieni PKH
      const oraclePKH = deserializeAddress(oracle).pubKeyHash;
      const p1PKH = deserializeAddress(player1).pubKeyHash;
      const p2PKH = deserializeAddress(player2).pubKeyHash;

      // 3. Crea datum
      const datum = makeBetDatum(oraclePKH, lovelace, p1PKH, p2PKH, deadline, false);

      // 4. Setup
      const assets: Asset[] = [{ unit: 'lovelace', quantity: wager }];
      const { scriptAddr } = getScript();

      // 5. Crea tx
      //const tx = new Transaction({ initiator: p2wallet });
      const txBuilder = new MeshTxBuilder({
        fetcher: provider, // get a provider https://meshjs.dev/providers
        verbose: true,
        });

      const unsignedTx = await txBuilder
        .txOut(scriptAddr, assets)
        .txOutDatumHashValue(datum)
        .changeAddress(userAddr)
        .selectUtxosFrom(utxos)
        .requiredSignerHash(p1PKH)
        .requiredSignerHash(p2PKH)
        .complete();
 

      // 6. Firma parziale
      console.log("Unsigned TX:", unsignedTx);
      const signedTx = await wallet.signTx(unsignedTx, true);

      // 7. (Opzionale) invio al backend per firma con chiave privata player2
      //const response = await fetch('http://localhost:3000/signJoin/', {
      //  method: 'POST',
      //  headers: { 'Content-Type': 'application/json' },
      //  body: JSON.stringify({ tx: partialTx }),
      //});

      console.log("Partial TX:", signedTx);
      const meshWalletSignedTx  = await p2wallet.signTx(signedTx, true);
      console.log("Unsigned TX:", meshWalletSignedTx);
      const txHash = await wallet.submitTx(meshWalletSignedTx)

      //const { signedTx, hash } = await response.json();

      setTxHash(txHash || 'Transaction sent!');
    } catch (err: any) {
      console.error(err);
      alert(`Join failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-md flex flex-col gap-4"
    >
      <h2 className="text-2xl font-semibold text-gray-800">Join Bet Contract</h2>

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
        {loading ? 'Joining…' : 'Join Bet'}
      </button>

      {txHash && (
        <p className="text-green-600 text-sm break-all">
          TX Hash: <code>{txHash}</code>
        </p>
      )}
    </form>
  );
}
