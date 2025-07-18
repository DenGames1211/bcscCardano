


import React, { FormEvent, useState } from 'react';
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

export default function BetDeploy() {
  const [oracle, setOracle] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [wager, setWager] = useState('1000000');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  const oracleMnemonic = ["post","crash","deer","idle","churn","cause","six","chuckle","priority","truth","tiger","disorder","devote","tree","clerk","planet","glance","jewel","start","erode","public","umbrella","aware","stamp"];




  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const wallet = await getBrowserWallet();
    const utxos = await wallet.getUtxos();
    const [addr] = await wallet.getUsedAddresses();

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


    const lovelace = BigInt(wager);
    const deadline = BigInt(Date.now() + TWO_MINUTES_MS);

    try {
        const [oracleAddr] = await oracleWallet.getUsedAddresses();
        const oraclePKH = deserializeAddress(oracleAddr).pubKeyHash;
        const oracleUtxos = await oracleWallet.getUtxos();
      // 2) build the datum
      const datum = makeBetDatum(
        deserializeAddress(oracle).pubKeyHash,
        0n, // start wager
        deserializeAddress(player1).pubKeyHash,
        deserializeAddress(player2).pubKeyHash,
        1n, // dummy deadline
        false // not yet joined
      );

      const newdatum = makeBetDatum(
        "",
        0n,
        "",
        "",
        0n,
        false,
      );
      // 3) prepare assets + scrip
      const assets: Asset[] = [{ unit: 'lovelace', quantity: "2000000" }];
      const { scriptAddr, scriptCbor } = getScript();
      const datumHash = resolveDataHash(datum);

      // 4) build, sign and submit
      const txBuilder = getTxBuilder()
        
        .txOut(scriptAddr, [{ unit: 'lovelace', quantity: '2000000' }]) // manda 2 ADA al contratto
        .txOutDatumHashValue(datum)
        .changeAddress(oracleAddr) // il tuo indirizzo (wallet mittente)
        .selectUtxosFrom(oracleUtxos) // UTxO da cui prendi i fondi
        .txInCollateral(oracleUtxos[0].input.txHash, oracleUtxos[0].input.outputIndex); 

      await txBuilder.complete();


      const signed = await oracleWallet.signTx(txBuilder.txHex);
      console.log("deploy transaction: ", txBuilder);
      const hash = await oracleWallet.submitTx(signed);


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
          TX Hash: <code>{txHash}</code>
        </p>
      )}
    </form>
  );
}
