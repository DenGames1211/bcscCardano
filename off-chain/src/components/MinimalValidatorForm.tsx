import React, { FormEvent, useState } from 'react';
import {
    Asset,
  BlockfrostProvider,
  deserializeAddress,
  Integer,
  mConStr0,
  MeshTxBuilder,
  pubKeyHash,
  resolveDataHash,
  resolvePlutusScriptAddress,
  serializePlutusScript,
  VerificationKey,
} from '@meshsdk/core';

import { getAssetUtxo, getBrowserWallet, getTxBuilder, getUtxoByTxHash } from '@/utils/common';
import { applyParamsToScript } from '@meshsdk/core-csl';
import blueprint from "@/scripts/minimal.plutus.json";
import { Datum } from '@/utils/types';
import { makeBetDatum } from '@/utils/bet';
import { Int } from '@emurgo/cardano-serialization-lib-asmjs';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);


function getMinimalScript() {
  const scriptCbor = applyParamsToScript(
    blueprint.validators[0].compiledCode,
    []
  );

  const scriptAddr = serializePlutusScript(
    { code: scriptCbor, version: "V3" },
  ).address;
 
  return { scriptCbor, scriptAddr };
}


function makeDatum(
    owner: string
): Datum {
  
  return mConStr0([
   owner,
  ]);
}

function makeRedeemer(
    val: bigint 
) {
    return mConStr0(
        [val]
    )
}


export default function MinimalValidatorForm() {
    const [txHash, setTxHash] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    async function handleDeploy(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);

        try {

            const wallet = await getBrowserWallet();
            const usedAddresses = await wallet.getUsedAddresses();
            if (!usedAddresses || usedAddresses.length === 0) throw new Error('No wallet address found.');
            
            const userAddress = usedAddresses[0];
            const utxos = await wallet.getUtxos();

            const {scriptCbor, scriptAddr} = getMinimalScript();
            console.log("script cbor: ", scriptCbor);
            const pubKeyHash = deserializeAddress(userAddress).pubKeyHash;
            
            const datum = makeDatum(
                pubKeyHash,
            );

            const assets: Asset[] = [{ unit: 'lovelace', quantity: "3000000" }];   // minimum ADA required for UTXO with datum
            
            
            const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });
            const unsignedTx = await txBuilder
                .setNetwork("preview")
                .txOutReferenceScript(scriptCbor, "V3")
                .txOut(
                    scriptAddr,
                    assets,
                )
                .txOutDatumHashValue(datum)
                .selectUtxosFrom(utxos)
                //.txOutReferenceScript(scriptCbor)
                .changeAddress(userAddress)
                .complete()
        
        const signed = await wallet.signTx(unsignedTx, true);
        const txHash = await wallet.submitTx(signed);
        console.log(txHash);

        setTxHash(txHash);
         } catch (err: any) {
            console.error(err);
            alert(`Deploy failed: ${err.message}`);
            setError(true);
        } finally {
            setLoading(false);
        }

    }

    async function handleStart(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);

        try {

            const wallet = await getBrowserWallet();
            const  [addr] = await wallet.getUsedAddresses();
            //if (!usedAddresses || usedAddresses.length === 0) throw new Error('No wallet address found.');
            
            const utxos = await wallet.getUtxos();

            const {scriptCbor, scriptAddr} = getMinimalScript();
            console.log("start cbor: ", scriptCbor);
             const pubKeyHash = deserializeAddress(addr).pubKeyHash;
        
            const datum = makeDatum(
                pubKeyHash,
            );

            //const deployUtxos = await getAssetUtxo({
            //    scriptAddress: scriptAddr,
            //    asset: 'lovelace',
            //    datum: datum,
            //});
            
            
            //if (!deployUtxos) {
            //throw new Error('No matching UTxO found with the given datum.');
            //}

            const deployTxHash = "31b6f995405caf860da81c0a66a8c3fc7082477b872888c57376b5d229efeafe";
            const deployUtxos =await getUtxoByTxHash(deployTxHash);
            if (!deployUtxos) {
                throw new Error('No matching UTxO found with the given tx Hash.');
            }

            console.log(deployUtxos);

            //const redeemer = mConStr0([1]);
            const redeemer = makeRedeemer(1n);


            const assets: Asset[] = [{ unit: 'lovelace', quantity: "3000000" }];   // minimum ADA required for UTXO with datum

            const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });
            const unsignedTx = await txBuilder
                .setNetwork("preview")
                .spendingPlutusScriptV3()
                .txIn(
                    deployTxHash,
                    deployUtxos.input.outputIndex,

                )
                .txInDatumValue(datum)
                .txInRedeemerValue(redeemer)
                .txInScript(scriptCbor)
                .txInCollateral(utxos[0].input.txHash, utxos[0].input.outputIndex)
                .txOut(
                    scriptAddr,
                    assets,
                )
                .txOutDatumHashValue(datum)
                .selectUtxosFrom(utxos)
                //.txOutReferenceScript(scriptCbor)
                .requiredSignerHash(pubKeyHash)
                .changeAddress(addr)
                .complete();
        
        const signed = await wallet.signTx(unsignedTx, true);
        const txHash = await wallet.submitTx(signed);
        console.log(txHash);

        setTxHash(txHash);
         } catch (err: any) {
            console.error(err);
            alert(`Start failed: ${err.message}`);
            setError(true);
        } finally {
            setLoading(false);
        }

    }



  return (
 
       <main>
        <form className="flex flex-col gap-4" onSubmit={handleDeploy}>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl"
              type="submit"
             >
              Deploy Contract
            </button>
        </form>
        

        <form className="flex flex-col gap-4" onSubmit={handleStart}>
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl"
              
            >
              🎯 Start Auction
            </button>
        </form>

        {txHash && (
          <div className="mt-6 text-green-700 break-all">
            ✅ Transaction submitted: <br />
            <code>{txHash}</code>
          </div>
        )}
        {error && (
          <div className="mt-6 text-red-600">
            ❌ Error: {error}
          </div>
        )}
    </main>
  );
}


