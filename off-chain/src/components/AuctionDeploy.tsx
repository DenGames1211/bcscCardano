import React, { FormEvent, useState } from 'react';
import {
    Asset,
  BlockfrostProvider,
  deserializeAddress,
  resolveDataHash,
  resolvePlutusScriptAddress,
} from '@meshsdk/core';

import { getBrowserWallet, getAuctionScript, getTxBuilder } from '@/utils/common';
import { makeAuctionDatum, AuctionStatus } from '@/utils/auction';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

type Props = {
  onDeploy: (object: string, deadline: bigint) => void;
};





export default function AuctionDeploy({ onDeploy }: Props) {
  const [seller, setSeller] = useState('');
  const [durationValue, setDurationValue] = useState<number>(1); // default: 1 unit
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours'>('hours');
  const [auctionDuration, setAuctionDuration] = useState<bigint>(BigInt(0));
  const [startingBid, setStartingBid] = useState<bigint>(0n);
  const [object, setObject] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);

  function updateAuctionDuration(val: number, unit: 'minutes' | 'hours') {
  const durationInSeconds = unit === 'hours' 
    ? val * 3600 
    : val * 60;

    setAuctionDuration(BigInt(durationInSeconds));
  }

  function handleDurationChange(val: number) {
    setDurationValue(val);
    updateAuctionDuration(val, durationUnit);
  }

  function handleUnitChange(unit: 'minutes' | 'hours') {
  let newDurationValue = durationValue;

  if (unit === 'minutes' && durationUnit === 'hours') {
    // Converti ore in minuti interi
    newDurationValue = Math.round(durationValue * 60);
  } else if (unit === 'hours' && durationUnit === 'minutes') {
    // Converti minuti in ore (step di 0.5)
    newDurationValue = Math.round(durationValue / 30) * 0.5;
  }

  setDurationUnit(unit);
  setDurationValue(newDurationValue);
  updateAuctionDuration(newDurationValue, unit);
}



  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const wallet = await getBrowserWallet();
      const usedAddresses = await wallet.getUsedAddresses();
      if (!usedAddresses || usedAddresses.length === 0) throw new Error('No wallet address found.');

      const userAddress = usedAddresses[0];
      setSeller(userAddress); 

      const utxos = await wallet.getUtxos();

      // 1. Prepare script and address
      const {scriptCbor, scriptAddr} = getAuctionScript(); 

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
        pubKeyHash, // first bidder is the seller
        startingBid // initial amount must be 0
      );

      //const assets: Asset[] = [{ unit: 'lovelace', quantity: startingBid.toString() }];
      const assets: Asset[] = [{ unit: 'lovelace', quantity: "2000000" }];   // minimum ADA required for UTXO with datum
      const datumHash = resolveDataHash(datum);
      // 5. Build and submit the transaction
      const txBuilder = getTxBuilder()
        .mintPlutusScriptV3()
        .setNetwork("preview")
        .txOut(
            scriptAddr,
            assets,
        )
        //.txOutInlineDatumValue(datum)
        .txOutDatumHashValue(datum)
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
  {/* Auction Object */}
  <input
    type="text"
    placeholder="Auction Object"
    value={object}
    onChange={(e) => setObject(e.target.value)}
    required
    className="border rounded-lg px-3 py-2 w-full"
  />

  {/* Duration + unit, same width as input above */}
  <div className="flex w-full gap-2">
    <input
      type="number"
      step={durationUnit === 'hours' ? 0.5 : 1}
      min={1}
      value={durationValue}
      onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
      required
      className="border rounded-lg px-3 py-2 flex-grow"
    />
    <select
      value={durationUnit}
      onChange={(e) => handleUnitChange(e.target.value as 'minutes' | 'hours')}
      className="border rounded-lg px-3 py-2 w-28"
    >
      <option value="minutes">Minuti</option>
      <option value="hours">Ore</option>
    </select>
  </div>

  {/* Submit button */}
  <button
    type="submit"
    className="bg-blue-600 text-white rounded-xl py-2 font-semibold hover:bg-blue-700 transition duration-200"
  >
    Deploy
  </button>
</form>

  );

}

  

