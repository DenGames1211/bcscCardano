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

} from '@meshsdk/core';
import { getScript, getAssetUtxo, getBrowserWallet } from '@/utils/common';
import { makeBetDatum } from '@/utils/bet';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);
const FIVE_MINUTES_MS = 5 * 60 * 1000;


interface BetTimeoutParams {
  player1: string;
  player2: string;
  oracleAddr: string;
  wager: string;
  deadline: bigint;
}

export async function betTimeout({
  player1,
  player2,
  oracleAddr,
  wager,
  deadline,
}: BetTimeoutParams): Promise<{ unsignedTx: string | null}> {
  try {


    const p1PKH = deserializeAddress(player1).pubKeyHash;
    const p2PKH = deserializeAddress(player2).pubKeyHash;
    const oraclePKH = deserializeAddress(oracleAddr).pubKeyHash;
    const lovelace = BigInt(wager);
    //const deadline = BigInt(Date.now() + FIVE_MINUTES_MS);
    const datum = makeBetDatum(oraclePKH, lovelace, p1PKH, p2PKH, deadline, true);

    const { scriptCbor, scriptAddr } = getScript();

    const redeemer = {
    data: {
        alternative: 2,
        fields: [],
    },
    };

    
    const assetUtxo = await getAssetUtxo({
        scriptAddress: scriptAddr,
        asset: "lovelace",
        datum: datum,
        });
    
        if (!assetUtxo) {
        throw new Error("No matching UTxO found with the given datum.");
        }
    
        const plutusScript: PlutusScript = {
        code: scriptCbor,
        version: 'V3',
        };
    
        const p1wallet = await getBrowserWallet();
        const tx = new Transaction({initiator: p1wallet, fetcher: provider})
            .redeemValue({
                value: assetUtxo,
                script: plutusScript,
                datum: datum,
                redeemer: redeemer,
            })
        .setRequiredSigners([player1, player2]);

        const unsignedTx = await tx.build();

    return{unsignedTx: unsignedTx};

  } catch (err) {
    console.error('Error in betTimeout:', err);
    return { unsignedTx: null};
  }

}