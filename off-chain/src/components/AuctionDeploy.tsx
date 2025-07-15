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

type Props = {
  onDeploy: (object: string, deadline: bigint) => void;
};


export default function AuctionDeploy({ onDeploy }: Props) {
  const [seller, setSeller] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('');
  const [startingBid, setStartingBid] = useState<bigint>(0n);
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
      onDeploy(object, deadline);

      // 3. Extract PubKeyHash
      const pubKeyHash = deserializeAddress(userAddress).pubKeyHash;

      // 4. Create datum and assets
      const datum = makeAuctionDatum(
        pubKeyHash,
        object,
        deadline,
        AuctionStatus.NOT_STARTED,
        "", // first bidder is the seller
        startingBid // initial amount must be 0
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        type="text"
        placeholder="Auction Object"
        value={object}
        onChange={(e) => setObject(e.target.value)}
        required
        className="border rounded-lg px-3 py-2"
      />
      <input
        type="number"
        placeholder="Duration (seconds)"
        value={auctionDuration}
        onChange={(e) => setAuctionDuration(e.target.value)}
        required
        className="border rounded-lg px-3 py-2"
      />
      <button
        type="submit"
        className="bg-blue-600 text-white rounded-xl py-2 font-semibold hover:bg-blue-700 transition duration-200"
      >
        Deploy
      </button>
    </form>
  );

}

  

