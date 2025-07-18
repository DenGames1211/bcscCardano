'use client';

import React, { FormEvent, useState } from 'react';
import {
  Asset,
  BlockfrostProvider,
  deserializeAddress,
  hexToBytes,
  MeshTxBuilder,
  serializeData,
} from '@meshsdk/core';
import {
  getBrowserWallet,
  getAuctionScript,
  getAssetUtxo,
} from '@/utils/common';
import {
  makeAuctionDatum,
  AuctionStatus,
  makeStartRedeemer,
} from '@/utils/auction';
import { handleEndAuction } from '@/utils/auctionEnd'; 

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

interface AuctionStartProps {
  object: string;
  deadline: bigint;
}

export default function AuctionStart({ object, deadline }: AuctionStartProps) {
  const [startingBid, setStartingBid] = useState<string>('100000000'); 
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [endTxHash, setEndTxHash] = useState('');
  const [endLoading, setEndLoading] = useState(false);
  const [datumLoaded, setDatumLoaded] = useState(false);


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setTxHash('');

    try {
      const sellerWallet = await getBrowserWallet();
      const sellerUtxos = await sellerWallet.getUtxos();
      const [addr] = await sellerWallet.getUsedAddresses();

      const { scriptCbor, scriptAddr } = getAuctionScript();
      const sellerPubKeyHash = deserializeAddress(addr).pubKeyHash;

      const startingBidBigInt = BigInt(startingBid);

      const datum = makeAuctionDatum(
        sellerPubKeyHash,
        object,
        deadline,
        AuctionStatus.STARTED,
        sellerPubKeyHash,
        startingBidBigInt
      );

      const deployDatum = makeAuctionDatum(
        sellerPubKeyHash,
        object,
        deadline,
        AuctionStatus.NOT_STARTED,
        sellerPubKeyHash,
        BigInt(0)
      );

      const redeemer = makeStartRedeemer();

      const assets: Asset[] = [
        { unit: 'lovelace', quantity: startingBidBigInt.toString() },
      ];

      const sellerAssets: Asset[] = [
        { unit: 'lovelace', quantity: '2000000' },
      ];

      const deployUtxos = await getAssetUtxo({
        scriptAddress: scriptAddr,
        asset: 'lovelace',
        datum: deployDatum,
      });

      if (!deployUtxos) {
        throw new Error('No matching UTxO found with the given datum.');
      }

      setDatumLoaded(true); 

      console.log(deployUtxos);

      const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

      const unsignedTx = await txBuilder
        .setNetwork("preview")
        .spendingPlutusScriptV3()
        .txIn(deployUtxos.input.txHash, deployUtxos.input.outputIndex)
        //.txInInlineDatumPresent()
        .txInDatumValue(deployDatum)
        .txInRedeemerValue(serializeData(redeemer), 'CBOR')
        .txInCollateral(sellerUtxos[0].input.txHash, sellerUtxos[0].input.outputIndex)
        .txInScript(scriptCbor)
        .txOut(scriptAddr, assets)
        .txOutInlineDatumValue(datum)
        .txOut(addr, sellerAssets)
        .changeAddress(addr)
        .selectUtxosFrom(sellerUtxos)
        .requiredSignerHash(sellerPubKeyHash)
        .complete();

      const signedTx = await sellerWallet.signTx(unsignedTx, true);
      const txHash = await sellerWallet.submitTx(signedTx);
      setTxHash(txHash || 'Transaction sent!');
    } catch (err: any) {
      console.error(err);
      alert(`Start failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnd() {
    try {
      setEndLoading(true);
      setEndTxHash('');

      const wallet = await getBrowserWallet();
      const [address] = await wallet.getUsedAddresses();

      const tx = await handleEndAuction(address, object, deadline);
      setEndTxHash(tx);
    } catch (err: any) {
      console.error(err);
      alert(`End failed: ${err.message}`);
    } finally {
      setEndLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Display Object & Deadline */}
      <div className="text-sm text-gray-700">
        <p><strong>Object: </strong> {object}</p>
        <p><strong>Deadline: </strong>
        {Number(deadline) !== 0 && (
           
            new Date(Number(deadline)).toLocaleString('it-IT', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false // orario in formato 24h
            })
          
        )}
        </p>
      </div>

      {/* Starting Bid Input */}
      <input
        type="number"
        placeholder="Initial Bid (lovelace)"
        value={startingBid}
        onChange={(e) => setStartingBid(e.target.value)}
        required
        className="border rounded-lg px-3 py-2"
      />

      {/* Start Auction Button */}
      <button
        type="submit"
        disabled={loading}
        className="bg-green-600 text-white rounded-xl py-2 font-semibold hover:bg-green-700 transition duration-200 disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Start Auction'}
      </button>

      {/* End Auction Button */}
      <button
        type="button"
        onClick={handleEnd}
        disabled={!object || !deadline || endLoading}
        className="bg-red-600 text-white rounded-xl py-2 font-semibold hover:bg-red-700 transition duration-200 disabled:opacity-50"
      >
        {endLoading ? 'Ending...' : 'End Auction'}
      </button>

      {/* TX Hashes Output */}
      {txHash && (
        <div className="mt-2 text-sm text-green-700 break-words">
          <strong>Start Tx:</strong> {txHash}
        </div>
      )}
      {endTxHash && (
        <div className="mt-2 text-sm text-blue-700 break-words">
          <strong>End Tx:</strong> {endTxHash}
        </div>
      )}
    </form>
  );
}



