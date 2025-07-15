import React, { FormEvent, useState } from 'react';
import {
    Asset,
  BlockfrostProvider,
  deserializeAddress,
  resolvePlutusScriptAddress,
} from '@meshsdk/core';

import { getBrowserWallet, getScript, getTxBuilder } from '@/utils/common';
import { makeAuctionDatum, AuctionStatus } from '@/utils/auction';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

export default function AuctionDeploy() {
  const [seller, setSeller] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('');
  const [startingBid, setStartingBid] = useState<bigint>(2000000n);
  const [object, setObject] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const wallet = await getBrowserWallet();
      const usedAddresses = await wallet.getUsedAddresses();
      if (!usedAddresses || usedAddresses.length === 0) throw new Error('No wallet address found.');

      const userAddress = usedAddresses[0];
      setSeller(userAddress); // for UI display

      const utxos = await wallet.getUtxos();

      // 1. Prepare script and address
      const {scriptCbor, scriptAddr} = getScript(); 

      // 2. Prepare auction deadline (POSIX)
      const now = Date.now();
      const durationMs = Number(auctionDuration) * 1000;
      const deadline = BigInt(now + durationMs);

      // 3. Extract PubKeyHash
      const pubKeyHash = deserializeAddress(userAddress).pubKeyHash;

      // 4. Create datum and assets
      const datum = makeAuctionDatum(
        pubKeyHash,
        object,
        deadline,
        AuctionStatus.NOT_STARTED,
        '', // no bidder yet
        startingBid
      );

      //const assets: Asset[] = [{ unit: 'lovelace', quantity: startingBid.toString() }];
      const assets: Asset[] = [{ unit: 'lovelace', quantity: "2000000" }];   // minimum ADA required for UTXO with datum

      // 5. Build and submit the transaction
      const txBuilder = getTxBuilder()
        .txOut(
            scriptAddr,
            assets,
        )
        .txOutInlineDatumValue(datum)
        .selectUtxosFrom(utxos)
        .changeAddress(userAddress);

      await txBuilder.complete();
      const signed = await wallet.signTx(txBuilder.txHex);
      const txHash = await wallet.submitTx(signed);

      setTxHash(txHash);
    } catch (err: any) {
      console.error(err);
      alert(`Deploy failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-md flex flex-col gap-4"
    >
      <h2 className="text-2xl font-semibold text-gray-800">Deploy Auction Contract</h2>

      {/* Object */}
      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Auction Object</label>
        <input
          type="text"
          value={object}
          onChange={(e) => setObject(e.target.value)}
          required
          className="border rounded-lg px-3 py-2"
        />
      </div>

      {/* Auction Duration */}
      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Auction Duration (seconds)</label>
        <input
          type="number"
          min="60"
          step="60"
          value={auctionDuration}
          onChange={(e) => setAuctionDuration(e.target.value)}
          required
          className="border rounded-lg px-3 py-2"
        />
      </div>

      {/* Starting Bid */}
      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Starting Bid (Lovelace)</label>
        <input
          type="number"
          min="1000000"
          step="100000"
          value={startingBid.toString()}
          onChange={(e) => setStartingBid(BigInt(e.target.value))}
          required
          className="border rounded-lg px-3 py-2"
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
        <p className="text-green-600 text-sm break-words">
          TX Hash: <code>{txHash}</code>
        </p>
      )}
    </form>
  );
}

  

