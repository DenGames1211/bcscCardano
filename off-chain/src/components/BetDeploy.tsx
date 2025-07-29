


import React, { FormEvent, useEffect, useState } from 'react';
import {
  Asset,
  BlockfrostProvider,
  deserializeAddress,
  MeshWallet,
  resolveDataHash,
} from '@meshsdk/core';
import { getBrowserWallet, getScript, getTxBuilder } from '@/utils/common';
import { makeBetDatum } from '@/utils/bet';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TEN_SECONDS_MS = 1 * 10 * 1000;
const ONE_MINUTE_MS = 1 * 60 * 1000;
const TWO_MINUTES_MS = 2 * 60 * 1000;
const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

const oracleMnemonic = ["post", "crash", "deer", "idle", "churn", "cause", "six", "chuckle", "priority", "truth", "tiger", "disorder", "devote", "tree", "clerk", "planet", "glance", "jewel", "start", "erode", "public", "umbrella", "aware", "stamp"];


export default function BetDeploy() {
  const [oracle, setOracle] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [wager, setWager] = useState('1000000');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

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
    })();
  }, []);

  //const oracleMnemonic = ["post","crash","deer","idle","churn","cause","six","chuckle","priority","truth","tiger","disorder","devote","tree","clerk","planet","glance","jewel","start","erode","public","umbrella","aware","stamp"];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);


    // player 1 wallet (User Browser Wallet)
    const p1wallet = await getBrowserWallet();
    const p1utxos = await p1wallet.getUtxos();
    const [p1addr] = await p1wallet.getUsedAddresses();
    setPlayer1(p1addr);


    const lovelace = BigInt(wager);
    const deadline = BigInt(Date.now() + TWO_MINUTES_MS);

    try {
      // 2) build the datum
      const datum = makeBetDatum(
        deserializeAddress(oracle).pubKeyHash,
        0n, // start wager (must be 0)
        deserializeAddress(player1).pubKeyHash,
        " ", // no need to add player 2 at deploy time 
        1n, // dummy deadline
        false // not yet joined
      );

      // 3) prepare assets + scrip
      // these are for the creation of the contract
      const assets: Asset[] = [{ unit: 'lovelace', quantity: "2000000" }];
      const { scriptAddr, scriptCbor } = getScript();
      const datumHash = resolveDataHash(datum);

      // 4) build, sign and submit
      const txBuilder = getTxBuilder()
        .setNetwork("preview")
        .txOut(
          scriptAddr,
          assets,
        )
        .txOutInlineDatumValue(datum)
        .selectUtxosFrom(p1utxos)
        .changeAddress(p1addr)


      await txBuilder.complete();
      const signed = await p1wallet.signTx(txBuilder.txHex);
      console.log("deploy transaction: ", txBuilder);
      const hash = await p1wallet.submitTx(signed);


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
          readOnly
          onChange={(e) => setPlayer1(e.target.value)}
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
          Deploy OK - TXHash: <code>{txHash}</code>
        </p>
      )}
    </form>
  );
}
