'use client';

import React, { FormEvent, useState, useEffect } from 'react';
import {
  Asset,
  BlockfrostProvider,
  deserializeAddress,
  MeshWallet,
  MeshTxBuilder,
  resolveDataHash,
  Budget,
} from '@meshsdk/core';
import {
  getBrowserWallet,
  getScript,
  getUtxoByTxHash,
  getTxBuilder,
  getAssetUtxo,
} from '@/utils/common';
import { makeAuctionDatum, AuctionStatus, makeStartRedeemer } from '@/utils/auction';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

interface AuctionStartProps {
  object: string;              // es. "Painting #123"
  deadline: bigint;            // POSIX time (ms since epoch as bigint)
}


export default function AuctionStart({ object, deadline }: AuctionStartProps) {

  const [seller, setSeller] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('');
  const [startingBid, setStartingBid] = useState<bigint>(100_000_000n); // starting bid is 100 ADA by contract default
  //const [object, setObject] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setLoading(true);

      try {
        const sellerWallet = await getBrowserWallet();
        const sellerUtxos = await sellerWallet.getUtxos();
        const [addr] = await sellerWallet.getUsedAddresses();
        setSeller(addr);

        const {scriptCbor, scriptAddr} = getScript(); 

        // Prepare auction deadline (POSIX)
        const now = Date.now();
        const durationMs = Number(auctionDuration) * 1000;
        const deadline = BigInt(now + durationMs);

        // Extract PubKeyHash
        const sellerPubKeyHash = deserializeAddress(addr).pubKeyHash;
        // 4. Create datum and assets
        const datum = makeAuctionDatum(
            sellerPubKeyHash,
            object,
            deadline,
            AuctionStatus.STARTED, // Auction is started by the seller
            sellerPubKeyHash,
            startingBid
        );

        const deployDatum = makeAuctionDatum(
            sellerPubKeyHash,
            object,
            deadline,
            AuctionStatus.NOT_STARTED,
            "",
            0n,
        );

        const redeemer = makeStartRedeemer();
        
        // assets representing the initial bid made by the seller
        const assets: Asset[] = [{ unit: 'lovelace', quantity: startingBid.toString() }]; 
        // 2 ADA must return to the seller for the creation of the contract
        const sellerAssets: Asset[] = [{ unit: 'lovelvace', quantity: "2000000" }] 
        
        const deployUtxos = await getAssetUtxo({
            scriptAddress: scriptAddr,
            asset: "lovelace",
            datum: deployDatum
        });

        if (!deployUtxos) {
            throw new Error("No matching UTxO found with the given datum.");
        }

        const collateralUtxos = (await sellerWallet.getUtxos()).filter(
            (utxo) => utxo.output.amount.length === 1 && utxo.output.amount[0].unit === "lovelace"
        );

        const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });
        const unsignedTx = await txBuilder
        .spendingPlutusScriptV3()
        .txIn(deployUtxos.input.txHash, deployUtxos.input.outputIndex)
        .txInDatumValue(deployDatum)
        .txInRedeemerValue(redeemer)
        .txInScript(scriptCbor)
        .txOut(scriptAddr, assets)
        .txOutInlineDatumValue(datum) 
        .txOut(seller, sellerAssets)  // seller gets back the 2 ADA from deploy
        .changeAddress(seller)
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
}
