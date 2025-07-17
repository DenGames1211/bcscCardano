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
  serializeData,
  mConStr,
} from '@meshsdk/core';
import {
  getBrowserWallet,
  getScript,
  getUtxoByTxHash,
} from '@/utils/common';
import { makeBetDatum, makeJoinRedeemer } from '@/utils/bet';
import { betWin } from '@/utils/betWin';
import { betTimeout } from '@/utils/betTimeout';

const FIVE_MINUTES_MS = 2 * 60 * 1000;
const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

export default function BetJoin() {
  const [oracle, setOracle] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [wager, setWager] = useState('1000000');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [status, setStatus] = useState<'idle' | 'waiting' | 'done'>('idle');
  const [winnerMsg, setWinnerMsg] = useState<string>('');
  const [borderColor, setBorderColor] = useState<string>('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [deployTxHash, setDeployTxHash] = useState('');

  const oracleMnemonic = ["post","crash","deer","idle","churn","cause","six","chuckle","priority","truth","tiger","disorder","devote","tree","clerk","planet","glance","jewel","start","erode","public","umbrella","aware","stamp"];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const wallet = await getBrowserWallet();
      const utxos = await wallet.getUtxos();
      const [userAddr] = await wallet.getUsedAddresses();

      const p2wallet = new MeshWallet({
        networkId: 0,
        fetcher: provider,
        submitter: provider,
        key: {
          type: 'mnemonic',
          words: ["perfect", "pass", "you", "fly", "auto", "soldier", "sauce", "stuff", "reduce", "finish", "carbon", "clerk", "tent", "expect", "surge", "wolf", "busy", "section", "sweet", "brisk", "dove", "seven", "taxi", "kidney"],
        },
      });
      await p2wallet.init();

      const p2Utxos = await p2wallet.getUtxos();

      const lovelace = BigInt(wager);
      const deadline = BigInt(Date.now() + FIVE_MINUTES_MS);

      const redeemer2 = {
        constructor: 0,
        fields: [{int: 4000000}],
      };

      const redeemer3 = makeJoinRedeemer(lovelace);
      const redeemer = mConStr(0, [4000000])
      //console.log("REDEEMER: ", JSON.stringify(redeemer, null, 2));


      const exUnits: Budget = {
        mem: 5000000,
        steps: 7000000,
      };

      const oraclePKH = deserializeAddress(oracle).pubKeyHash;
      const p1PKH = deserializeAddress(player1).pubKeyHash;
      const p2PKH = deserializeAddress(player2).pubKeyHash;
      const { scriptCbor, scriptAddr } = getScript();

      const datum = makeBetDatum(oraclePKH, lovelace, p1PKH, p2PKH, deadline, true);
      const prev_datum = makeBetDatum(oraclePKH, 0n, p1PKH, p2PKH, 1n, false);
      const assets: Asset[] = [{ unit: 'lovelace', quantity: (BigInt(wager) + BigInt(wager)).toString() }];
      const p1assets: Asset[] = [{ unit: 'lovelace', quantity: "1400000"}]

      console.log("deplot tx hash: ", deployTxHash);
      const utxo = await getUtxoByTxHash(deployTxHash);
      console.log("deploy utxos");

      const datumHash = resolveDataHash(datum);
      console.log("deploy datum hash: ", resolveDataHash(prev_datum));
      const originalDatumHash = String(utxo.output.dataHash);
      console.log("script: ", scriptCbor);
      console.log()
      const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });
      const unsignedTx = await txBuilder
      .spendingPlutusScriptV3()
      .txIn(
        utxo.input.txHash,
        utxo.input.outputIndex,
        utxo.output.amount,
        //utxo.output.address
      )
      .txInInlineDatumPresent()
      //.txInDatumValue(datum)
      //.txInRedeemerValue(redeemer)
      .txInRedeemerValue(serializeData(redeemer), "CBOR")
      .txInScript(scriptCbor)
      //.txInCollateral(utxo.input.txHash, utxo.input.outputIndex)
      .txInCollateral(utxos[0].input.txHash, utxos[0].input.outputIndex)
      .requiredSignerHash(p1PKH)
      .requiredSignerHash(p2PKH)
      .txOut(scriptAddr, assets)
      //.txOut(player1, p1assets)
      .txOutInlineDatumValue(serializeData(datum), "CBOR")
      //.txOutDatumHashValue(datum)
      .changeAddress(player1) // o player2, per fee
      //.selectUtxosFrom([...utxos, ...p2Utxos]) // per aggiungere la seconda metà
      .selectUtxosFrom(utxos)
      .complete();

      const signedTx = await wallet.signTx(unsignedTx, true);
      const meshWalletSignedTx = await p2wallet.signTx(signedTx, true);
      const joinTxHash = await wallet.submitTx(meshWalletSignedTx);
      setTxHash(joinTxHash || 'Transaction sent!');

      console.log("oracle hash key: ", oraclePKH);
      console.log("p1 hash key: ", p1PKH);
      console.log("p2 hash key: ", p2PKH);
      setStatus('waiting');

      // Avvia il countdown
      const secondsLeft = Math.floor(Number(deadline - BigInt(Date.now())) / 1000);
      setCountdown(secondsLeft);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // noWinner = Math.random() < 0.1;
      const noWinner = false;

      if (noWinner) {
        setTimeout(async () => {
          const resultTx = await betTimeout({
            player1,
            player2,
            oracleAddr: oracle,
            wager,
            deadline,
            datum,
            txHash: joinTxHash,
          });

          if (resultTx != null) {
            const unsignedTx = resultTx.toString();
            const signedTx = await wallet.signTx(unsignedTx, true);
            const meshWalletSignedTx = await p2wallet.signTx(signedTx, true);
            const txHash = await wallet.submitTx(meshWalletSignedTx);
            setTxHash(txHash || 'Transaction sent!');
          } else {
            setTxHash('Transaction not sent');
          }

          setWinnerMsg('Nessun vincitore.');
          setBorderColor('border-red-600');
          setStatus('done');
        }, FIVE_MINUTES_MS + 1);
      } else {
        //const delayMs = Math.floor(Math.random() * (TWO_MINUTES_MS - 10000)) + 5000;
        const delayMs = 1 * 1000;
        setTimeout(async () => {
          console.log("DATUM: ", resolveDataHash(datum));
          const result = await betWin({
            oracleMnemonic,
            player1,
            player2,
            oracleAddr: oracle,
            wager,
            deadline,
            datum,
            joinTxHash,
          });

          if (result.winner === null) {
            setWinnerMsg('Nessun vincitore.');
            setBorderColor('border-red-600');
          } else {
            setWinnerMsg(`Il vincitore è: ${result.winner}`);
            setBorderColor('border-green-600');
          }
          setStatus('done');
        }, delayMs);
      }
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
      className={`max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-md flex flex-col gap-4 border-4 ${borderColor}`}
    >
      <h2 className="text-2xl font-semibold text-gray-800">Join Bet Contract</h2>

      {status === 'idle' && <>
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

        <div className="flex flex-col">
          <label className="mb-1 font-medium text-gray-700">Deploy Transaction Hash</label>
          <input
            type="text"
            value={deployTxHash}
            onChange={(e) => setDeployTxHash(e.target.value)}
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
      </>}

      {status === 'waiting' && (
        <div className="text-orange-600 text-lg font-semibold flex flex-col gap-2">
          <p>In attesa che l'oracle stabilisca il vincitore…</p>
          {countdown !== null && (
            <p>⏳ Tempo rimanente: {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</p>
          )}
        </div>
      )}

      {status === 'done' && (
        <p className="text-xl font-bold">{winnerMsg}</p>
      )}

      {txHash && (
        <p className="text-green-600 text-sm break-all">
          TX Hash: <code>{txHash}</code>
        </p>
      )}
    </form>
  );
}
