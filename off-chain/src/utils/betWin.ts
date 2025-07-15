
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
    const winnerAddr = Math.random() < 0.5 ? player1 : player2;
    console.log("vincitore: ", winnerAddr.toString() === player1? "Player 1" : "Player 2");
    const winnerPKH = deserializeAddress(winnerAddr).pubKeyHash;
    const wagerTotal = (BigInt(wager) * 2n).toString();
    const lovelace = BigInt(wager);
    console.log("wager: ", wager);
    //const deadline = BigInt(Date.now() + FIVE_MINUTES_MS);

    const p1wallet = await getBrowserWallet();
    const p1utxos = await p1wallet.getUtxos();

    // 1. Get UTXOs at script address
  
    //const targetUtxo = scriptUtxos.find((utxo) => utxo.output.amount.find((a) => a.unit === 'lovelace' && BigInt(a.quantity) >= BigInt(wagerTotal)));

    //if (!targetUtxo) throw new Error('No suitable UTxO at script address');

    //const datum = makeBetDatum(oraclePKH, lovelace, p1PKH, p2PKH, deadline, true);
    const assets: Asset[] = [{ unit: "lovelace", quantity: wager }];
    const oracleUtxos = await oracle.getUtxos();
    const [oracleAd] = await oracle.getUsedAddresses();
    const [addr] = await oracle.getUsedAddresses();
    const { scriptCbor, scriptAddr } = getScript();
    const hash  = resolvePaymentKeyHash(oracleAddr);
    const scriptUtxos = await provider.fetchAddressUTxOs(scriptAddr);

    //const redeemer = {
    //  constructor: 1,
    //  fields: [{ bytes: winnerPKH }],
    //};

    const redeemer = makeWinRedeemer(winnerPKH);

    const exUnits: Budget = {
      mem: 5000000,
      steps: 7000000,
    };

    
    console.log("received datum: ", resolveDataHash(datum));
    console.log("datum structure: ", datum);
    await new Promise(res => setTimeout(res, 2 * 60 * 1000));
    const utxo = await getUtxoByTxHash(joinTxHash);
    console.log("utxos ricevuti: ", utxo);
    //const assetUtxo = await getAssetUtxo({
    //scriptAddress: scriptAddr,
    //asset: "lovelace",
    //datum: datum
    //});

    //if (!assetUtxo) {
    //throw new Error("No matching UTxO found with the given datum.");
    //}

    const plutusScript: PlutusScript = {
      code: scriptCbor,
      version: 'V3',
    };
  
  
  console.log("sended utxo: ", oracleUtxos);
  console.log("utxo txHash: ", utxo.input.txHash);
  console.log("utxo output index", utxo.input.outputIndex);
  console.log("utxo amount", utxo.output.amount);
  console.log("utxo out addr", utxo.output.address);
  console.log("script: ", scriptCbor);
  const newdatum = makeBetDatum(oraclePKH, lovelace, p1PKH, p2PKH, deadline, true);
  console.log("oracle address: ", oracleAddr);

  const collateralUtxos = (await oracle.getUtxos()).filter(
    (utxo) => utxo.output.amount.length === 1 && utxo.output.amount[0].unit === "lovelace"
  );

  const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

  const unsignedTx = await txBuilder
  .spendingPlutusScriptV3()
  .txIn(
    utxo.input.txHash,
    utxo.input.outputIndex,
    utxo.output.amount,
    utxo.output.address
  )
  .txInDatumValue(newdatum)
  .txInRedeemerValue(redeemer)
  .spendingTxInReference(utxo.input.txHash, utxo.input.outputIndex) 
  .txInScript(scriptCbor)
  .txOut(winnerAddr, assets) 
  .changeAddress(player1)
  .selectUtxosFrom(p1utxos)
  .txInCollateral(utxo.input.txHash, utxo.input.outputIndex)
  .requiredSignerHash(oraclePKH)
  .complete();


  //const tx = new Transaction({ initiator: oracle, fetcher: provider })
  //      .redeemValue({
  //          value: utxo,
  //          script: plutusScript,
  //          datum: datum,
  //          redeemer: redeemer,
  //      })
  //  .sendValue(winnerAddr, utxo)
  //  .setRequiredSigners([oracleAddr])

    //const unsignedTx = await tx.build();


    console.log("oracle key hash in betWin: ", oraclePKH);
    const signedTx = await oracle.signTx(unsignedTx, true);
    const txHash = await oracle.submitTx(signedTx);

    const winner = winnerAddr.toString();
    console.log("vincitore: ", winner === player1? "Player 1" : "Player 2");
    return { winner: winner , txHash: txHash};
  } catch (err) {
    console.error('Error in betWin:', err);
    return { winner: null, txHash: null};
  }
}

