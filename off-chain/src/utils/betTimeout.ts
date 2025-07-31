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
  Data,
  PlutusScript,
  option,
  mConStr0,

} from '@meshsdk/core';
import { getScript, getAssetUtxo, getUtxoByTxHash, getBrowserWallet } from '@/utils/common';
import { makeBetDatum, makeTimeoutRedeemer } from '@/utils/bet';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);
const FIVE_MINUTES_MS = 5 * 60 * 1000;


interface BetTimeoutParams {
  player1: string;
  player2: string;
  oracleAddr: string;
  wager: string;
  deadline: bigint;
  datum: Data;
  txHash: string;
}

export async function betTimeout({
  player1,
  player2,
  oracleAddr,
  wager,
  deadline,
  datum,
  txHash,
}: BetTimeoutParams): Promise<{ unsignedTx: string | null }> {
  try {


    const p1PKH = deserializeAddress(player1).pubKeyHash;
    const p2PKH = deserializeAddress(player2).pubKeyHash;
    const oraclePKH = deserializeAddress(oracleAddr).pubKeyHash;
    const lovelace = BigInt(wager);
    //const deadline = BigInt(Date.now() + FIVE_MINUTES_MS);
    const datum = makeBetDatum(
      oraclePKH,
      lovelace,
      p1PKH,
      p2PKH,
      deadline,
      1n
    );

    const { scriptCbor, scriptAddr } = getScript();

    const redeemer = mConStr0([3, ""]);


    //await new Promise(res => setTimeout(res, 1 * 60 * 1000));
    const joinUtxo = await getUtxoByTxHash(txHash);

    const p1wallet = await getBrowserWallet();
    const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });
    //const utxo = await getUtxoByTxHash(txHash);
    const p1utxos = await p1wallet.getUtxos();

    const assets: Asset[] = [{ unit: "lovelace", quantity: wager }];


    const unsignedTx = await txBuilder
      .setNetwork("preview")
      .spendingPlutusScriptV3()
      .txIn(
        joinUtxo.input.txHash,
        joinUtxo.input.outputIndex,
        //joinUtxo.output.amount,
        //joinUtxo.output.address
      )
      .txInInlineDatumPresent()
      .txInRedeemerValue(redeemer)

      .txInScript(scriptCbor)
      //.changeAddress(addr)
      .txInCollateral(
        p1utxos[0].input.txHash,
        p1utxos[0].input.outputIndex
      )
      .txOut(player1, assets)
      .txOut(player2, assets)
      .changeAddress(player1)
      .selectUtxosFrom(p1utxos)
      .requiredSignerHash(p1PKH)
      .requiredSignerHash(p2PKH)

      .complete();


    return { unsignedTx: unsignedTx };

  } catch (err) {
    console.error('Error in betTimeout:', err);
    return { unsignedTx: null };
  }

}