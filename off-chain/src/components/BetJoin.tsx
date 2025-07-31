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
  mConStr0,
} from '@meshsdk/core';
import {
  getBrowserWallet,
  getScript,
  getUtxoByTxHash,
  getAssetUtxo,
} from '@/utils/common';
import { makeBetDatum, makeJoinRedeemer } from '@/utils/bet';
import { betWin } from '@/utils/betWin';
import { betTimeout } from '@/utils/betTimeout';

const TWO_MINUTES_MS = 2 * 60 * 1000 + 30 * 1000;
const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

export default function BetJoin() {
  const [oracle, setOracle] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [wager, setWager] = useState('10000000');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [timeoutTxHash, setTimeoutTxHash] = useState("");
  const [winTxHash, setWinTxHash] = useState("");
  const [status, setStatus] = useState<'idle' | 'waiting' | 'done'>('idle');
  const [winnerMsg, setWinnerMsg] = useState<string>('');
  const [timeoutMsg, setTimeoutMsg] = useState<string>('');
  const [borderColor, setBorderColor] = useState<string>('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [deployTxHash, setDeployTxHash] = useState('');

  const oracleMnemonic = ["post", "crash", "deer", "idle", "churn", "cause", "six", "chuckle", "priority", "truth", "tiger", "disorder", "devote", "tree", "clerk", "planet", "glance", "jewel", "start", "erode", "public", "umbrella", "aware", "stamp"];
  const p2Mnemonic = ["perfect", "pass", "you", "fly", "auto", "soldier", "sauce", "stuff", "reduce", "finish", "carbon", "clerk", "tent", "expect", "surge", "wolf", "busy", "section", "sweet", "brisk", "dove", "seven", "taxi", "kidney"];
  useEffect(() => {
    (async () => {
      const p1wallet = await getBrowserWallet();
      const [p1addr] = await p1wallet.getUsedAddresses();
      setPlayer1(p1addr);

      // oracle wallet (Mesh Wallet)
      const oracleWallet = new MeshWallet({
        networkId: 0,
        fetcher: provider,
        submitter: provider,
        key: {
          type: 'mnemonic',
          words: oracleMnemonic,
        },
      });
      await oracleWallet.init();

      const [oracleAddr] = await oracleWallet.getUsedAddresses();
      setOracle(oracleAddr);

      // player 2 wallet (MESH Wallet)
      const p2wallet = new MeshWallet({
        networkId: 0,
        fetcher: provider,
        submitter: provider,
        key: {
          type: 'mnemonic',
          words: p2Mnemonic,
        },
      });
      await p2wallet.init();

      const [p2Addr] = await p2wallet.getUsedAddresses();
      setPlayer2(p2Addr);
    })();
  }, []);


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
      const deadline = BigInt(Date.now() + TWO_MINUTES_MS);

      const redeemer = mConStr0([0, ""]); // join redeemer
      //console.log("REDEEMER: ", JSON.stringify(redeemer, null, 2));


      const exUnits: Budget = {
        mem: 5000000,
        steps: 7000000,
      };

      const oraclePKH = deserializeAddress(oracle).pubKeyHash;
      const p1PKH = deserializeAddress(player1).pubKeyHash;
      const p2PKH = deserializeAddress(player2).pubKeyHash;
      const { scriptCbor, scriptAddr } = getScript();

      const datum = makeBetDatum(
        oraclePKH,
        lovelace,
        p1PKH,
        p2PKH,
        deadline,
        1n,
        //"00000000000000000000000000000000000000000000000000000000",
      );
      console.log("DATUM:", datum);
      const totalWager = BigInt(wager) * 2n;
      const assets = [{ unit: 'lovelace', quantity: totalWager.toString() }];
      const p2Assets = [{ unit: 'lovelace', quantity: wager }];

      const deployDatum = makeBetDatum(
        oraclePKH,
        lovelace,
        p1PKH,
        "00000000000000000000000000000000000000000000000000000000",
        1n,
        0n,
        //"00000000000000000000000000000000000000000000000000000000",
      );


      console.log("deploy tx hash: ", deployTxHash);
      const utxo = await getUtxoByTxHash(deployTxHash);

      const p2Utxo = p2Utxos.find(u => BigInt(u.output.amount[0].quantity) >= lovelace);
      if (!p2Utxo) throw new Error("Player 2 has no valid UTxO");

      const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });
      const unsignedTx = await txBuilder
        .setNetwork("preview")
        .spendingPlutusScriptV3()
        .txIn(
          utxo.input.txHash,
          utxo.input.outputIndex,
          //utxo.output.amount,
          //scriptAddr
        )

        .spendingReferenceTxInInlineDatumPresent()
        .spendingReferenceTxInRedeemerValue(redeemer)


        .txInScript(scriptCbor)
        .txInCollateral(
          p2Utxos[0].input.txHash,
          p2Utxos[0].input.outputIndex,
        )

        // p2 is sending the total wager to the contract
        .txOut(scriptAddr, assets)
        .txOutInlineDatumValue(datum)

        // player 2 receive the change (wager spent by player 1 at deploy time)
        .changeAddress(player2)

        // both player must sign the transaction
        .requiredSignerHash(p1PKH)
        .requiredSignerHash(p2PKH)
        // player 2 has to pay the fees
        .selectUtxosFrom(p2Utxos)

        .complete();

      const signedTx = await p2wallet.signTx(unsignedTx, true);
      const meshWalletSignedTx = await wallet.signTx(signedTx, true);
      const joinTxHash = await p2wallet.submitTx(meshWalletSignedTx);
      //const joinTxHash = await wallet.submitTx(signedTx);
      setTxHash(joinTxHash || 'Transaction sent!');

      console.log("oracle hash key: ", oraclePKH);
      console.log("p1 hash key: ", p1PKH);
      console.log("p2 hash key: ", p2PKH);
      setStatus('waiting');

      // Countdown start
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

      //const noWinner = Math.random() < 0.2;
      const noWinner = true;


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


          setTimeoutMsg('No winner: the oracle did not decide before the deadline.');
          //setWinnerMsg('No winners: the Oracle has not decided a winner before the deadline.');
          setBorderColor('border-red-600');
          setStatus('done');

          console.log(resultTx);

          if (resultTx != null) {

            const unsignedTx = (resultTx.unsignedTx == null ? "" : resultTx.unsignedTx);
            const signedTx = await wallet.signTx(unsignedTx, true);
            const meshWalletSignedTx = await p2wallet.signTx(signedTx, true);
            const txHash = await wallet.submitTx(meshWalletSignedTx);
            setTimeoutTxHash(txHash || 'Transaction sent!');
          } else {
            setTimeoutTxHash('Transaction not sent');
          }

        }, TWO_MINUTES_MS + 1);
      } else {
        const delayMs = Math.floor(Math.random() * (TWO_MINUTES_MS - 10000)) + 5000;
        //const delayMs = 1 * 1000;
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
            setWinnerMsg(`The winner is: ${result.winner}!`);
            setBorderColor('border-green-600');
            setWinTxHash(result.txHash == null ? "" : result.txHash);
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
      className={`max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-md flex flex-col gap-4`}
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
          <p>Waiting for the oracle to decide the winner…</p>
          {countdown !== null && (
            <p>⏳ Time left: {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</p>
          )}
        </div>
      )}

      {status === 'done' && (
        <p className="text-green-700 text-xl font-bold">{winnerMsg}</p>
      )}

      {timeoutMsg && (
        <p className="text-red-600 text-sm font-semibold">{timeoutMsg}</p>
      )}

      {txHash && (
        <p className="text-green-600 text-sm break-all">
          Join successful - TXHash: <code>{txHash}</code>
        </p>
      )}

      {timeoutTxHash && (
        <p className="text-green-600 text-sm break-all">
          Timeout successful - TXHash: <code>{timeoutTxHash}</code>
        </p>
      )}

      {winTxHash && (
        <p className="text-green-600 text-sm break-all">
          Win successful - TXHash: <code>{winTxHash}</code>
        </p>
      )}
    </form>
  );
}
