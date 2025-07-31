
import {
  Asset,
  BlockfrostProvider,
  MeshWallet,
  MeshTxBuilder,
  deserializeAddress,
  resolvePaymentKeyHash,
  resolvePlutusScriptAddress,
  resolveDataHash,
  Transaction,
  PlutusScript,
  BuilderData,
  Budget,
  mConStr0,
} from '@meshsdk/core';
import { Data } from '@meshsdk/core';
import { getScript, getBrowserWallet, getAssetUtxo, getUtxoByTxHash, getUtxoByTxHashWithRetry } from '@/utils/common';
import { makeBetDatum, makeWinRedeemer } from '@/utils/bet';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);
const FIVE_MINUTES_MS = 5 * 60 * 1000;


interface BetWinParams {
  oracleMnemonic: string[];
  player1: string;
  player2: string;
  oracleAddr: string;
  wager: string;
  deadline: bigint;
  datum: Data;
  joinTxHash: string;
}

export async function betWin({

  oracleMnemonic,
  player1,
  player2,
  oracleAddr,
  wager,
  deadline,
  datum,
  joinTxHash,
}: BetWinParams): Promise<{ winner: string | null, txHash: string | null }> {
  try {
    const oracle = new MeshWallet({
      networkId: 0,
      fetcher: provider,
      submitter: provider,
      key: {
        type: 'mnemonic',
        words: oracleMnemonic,
      },
    });
    await oracle.init();

    const p1PKH = deserializeAddress(player1).pubKeyHash;
    const p2PKH = deserializeAddress(player2).pubKeyHash;
    const oraclePKH = deserializeAddress(oracleAddr).pubKeyHash;
    const oracleUtxos = await oracle.getUtxos();
    const winnerAddr = Math.random() < 0.5 ? player1 : player2;
    console.log("vincitore: ", winnerAddr.toString() === player1 ? "Player 1" : "Player 2");
    const winnerPKH = deserializeAddress(winnerAddr).pubKeyHash;
    const wagerTotal = (BigInt(wager) * 2n).toString();
    const lovelace = BigInt(wager);
    console.log("wager: ", wager);
    //const deadline = BigInt(Date.now() + FIVE_MINUTES_MS);

    const p1wallet = await getBrowserWallet();
    const p1utxos = await p1wallet.getUtxos();



    const assets: Asset[] = [{ unit: "lovelace", quantity: (BigInt(wager) * 2n).toString() }];

    const [oracleAd] = await oracle.getUsedAddresses();
    const [addr] = await oracle.getUsedAddresses();
    const { scriptCbor, scriptAddr } = getScript();
    //const hash = resolvePaymentKeyHash(oracleAddr);
    //const scriptUtxos = await provider.fetchAddressUTxOs(scriptAddr);

    const redeemer = mConStr0([2, winnerPKH]);

    const exUnits: Budget = {
      mem: 5000000,
      steps: 7000000,
    };

    await new Promise(res => setTimeout(res, 1 * 60 * 1000));

    // getting Join tx Utxos: 
    const utxo = await getUtxoByTxHash(joinTxHash);
    console.log("utxos ricevuti: ", utxo);


    console.log("sended utxo: ", oracleUtxos);
    console.log("utxo txHash: ", utxo.input.txHash);
    console.log("utxo output index", utxo.input.outputIndex);
    console.log("utxo amount", utxo.output.amount);
    console.log("utxo out addr", utxo.output.address);
    console.log("script: ", scriptCbor);

    const newdatum = makeBetDatum(
      oraclePKH,
      lovelace,
      p1PKH,
      p2PKH,
      deadline,
      1n,
      //winnerPKH,
    );
    console.log("oracle address: ", oracleAddr);


    const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

    const unsignedTx = await txBuilder
      .setNetwork("preview")
      .spendingPlutusScript("V3")
      .txIn(
        utxo.input.txHash,
        utxo.input.outputIndex,
        utxo.output.amount,
        utxo.output.address
      )

      .txInInlineDatumPresent()
      .txInRedeemerValue(redeemer)

      .txInScript(scriptCbor)
      // in case the tx fails, collateral are up to the oracle
      .txInCollateral(
        oracleUtxos[0].input.txHash,
        oracleUtxos[0].input.outputIndex
      )

      .txOut(winnerAddr, assets)
      .txOutInlineDatumValue(newdatum)
      .changeAddress(oracleAddr)
      // oracle pays fees
      .selectUtxosFrom(oracleUtxos)
      // oracle must be the signer
      .requiredSignerHash(oraclePKH)
      .complete();


    console.log("oracle key hash in betWin: ", oraclePKH);
    const signedTx = await oracle.signTx(unsignedTx, true);
    const txHash = await oracle.submitTx(signedTx);

    const winner = winnerAddr.toString();
    let winner_str = (winner === player1 ? "Player 1" : "Player 2");
    console.log("vincitore: ", winner_str);
    return { winner: winner_str, txHash: txHash };
  } catch (err) {
    console.error('Error in betWin:', err);
    return { winner: null, txHash: null };
  }
}

