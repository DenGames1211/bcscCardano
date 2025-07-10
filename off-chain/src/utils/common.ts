import fs from "node:fs";
import {
  Asset,
  BlockfrostProvider,
  BrowserWallet,
  mConStr0,
  MeshTxBuilder,
  MeshWallet,
  serializePlutusScript,
  PlutusScript,
  resolvePlutusScriptAddress,
  UTxO,
} from "@meshsdk/core";
import { applyParamsToScript, resolveDataHash } from "@meshsdk/core-csl";
import betBlueprint from "@/scripts/bet.plutus.json";
import { useWallet } from "@meshsdk/react";
 
const blockchainProvider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);
 
let _wallet: BrowserWallet | null = null;
/**
 * Lazily initialize (and cache) a BrowserWallet instance.
 *
 * @param walletName – the CIP-30 wallet extension id (e.g. 'lace', 'nami', etc.)
 * @throws if called on the server, or if the extension isn’t found, or if enable() fails
 */
export async function getBrowserWallet(walletName: string = "lace"): Promise<BrowserWallet> {
  // 1) Don't run in SSR
  if (typeof window === "undefined") {
    throw new Error("getBrowserWallet() can only be called in the browser");
  }

  // 2) Return the cached wallet if already connected
  if (_wallet) {
    return _wallet;
  }

  // 3) Make sure the extension is actually injected
  const injected = (window as any).cardano;
  if (!injected || !injected[walletName]) {
    throw new Error(
      `No CIP-30 provider found for '${walletName}'. ` +
      `Make sure you have the ${walletName} extension installed and enabled.`
    );
  }

  // 4) Try to enable (this will open the “Connect” popup)
  try {
    _wallet = await BrowserWallet.enable(walletName);
  } catch (err: any) {
    const msg = err?.message || err?.toString() || "Unknown error";
    throw new Error(`Failed to enable '${walletName}': ${msg}`);
  }

  return _wallet;
}
 
export function getScript() {
  const scriptCbor = applyParamsToScript(
    betBlueprint.validators[0].compiledCode,
    []
  );
 
  const scriptAddr = serializePlutusScript(
    { code: scriptCbor, version: "V3" },
  ).address;
 
  return { scriptCbor, scriptAddr };
}

export function getScript2() {
  const scriptCbor = applyParamsToScript(betBlueprint.validators[0].compiledCode, []);

  const script: PlutusScript = {
    code: scriptCbor,
    version: "V3",
  };
  const scriptAddr = resolvePlutusScriptAddress(script, 0);
  return { script, scriptAddr };
}
 
// reusable function to get a transaction builder
export function getTxBuilder() {
  return new MeshTxBuilder({
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
  });
}
 
// reusable function to get a UTxO by transaction hash
export async function getUtxoByTxHash(txHash: string): Promise<UTxO> {
  const utxos = await blockchainProvider.fetchUTxOs(txHash);
  if (utxos.length === 0) {
    throw new Error("UTxO not found");
  }
  return utxos[0];
}

export type Datum = ReturnType<typeof mConStr0>;
export type DatumConstructor<Input> = (input: Input) => Datum;
export type VariadicDatumConstructor<Args extends any[]> = (...args: Args) => Datum;

/**
 * Locks the given assets into your on‐chain contract, using the provided datum.
 *
 * @param assets     – an array of `{ unit: string; quantity: string }`
 * @param datumCtor  – a function that, given any input, returns the serialized datum you want to attach
 * @param datumInput – the raw input that your datum constructor needs (e.g. a pubKeyHash, a number, whatever)
 * @returns the transaction hash of the lock
 */
export async function lockAssetsWithDatum<Input>(
  assets: Asset[],
  datumCtor: DatumConstructor<Input>,
  datumInput: Input
): Promise<string> {
  // 1) grab UTXOs and your change address
  const utxos = await _wallet!.getUtxos();
  const [walletAddress] = await _wallet!.getUsedAddresses();

  // 2) get your script (address + validator, etc.)
  const { scriptAddr } = getScript();

  // 3) build the transaction
  const txBuilder = getTxBuilder()
    .txOut(scriptAddr, assets)                   // funds → script
    .txOutDatumHashValue(datumCtor(datumInput))  // attach your custom datum
    .changeAddress(walletAddress)                // return change
    .selectUtxosFrom(utxos);                     // pay from your UTXOs

  await txBuilder.complete();

  // 4) sign & submit
  const unsignedTx = txBuilder.txHex;
  const signedTx = await _wallet!.signTx(unsignedTx);
  const txHash = await _wallet!.submitTx(signedTx);

  return txHash;
}

export async function getAssetUtxo({
  scriptAddress,
  asset,
  datum,
}: {
  scriptAddress: string;
  asset: string;
  datum: any;
}) {
  const provider = blockchainProvider;
  const utxos = await provider.fetchAddressUTxOs(
    scriptAddress,
    asset,
  );
  console.log("UTxOs at script:", utxos);
  const dataHash = resolveDataHash(datum);
  //const dataHash = "c34b76230b9670a097bdbfc9e85ea5f7e02dbc0399806594a3c62ec7fd93402a"
  console.log("Looking for dataHash:", resolveDataHash(datum));
  //dataHash = "78769eb5e5c09a9f5b6e6558bc1527d79a20d428f32ce78c404d0ddbb3bbcc4f"
  //console.log("script addr used: ", scriptAddress)
 

  let utxo = utxos.find((utxo: any) => {
    return utxo.output.dataHash == dataHash;
  });

  return utxo;
}


export async function getUtxoByTxHashWithRetry(txHash: string, retries = 10, delay = 1500): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await blockchainProvider.fetchUTxOs(txHash);
      if (result && result.length > 0) {
        return result[0]; // oppure filtrare quello giusto se ce ne sono più
      }
    } catch (err: any) {
      if (err.status === 404) {
        console.log(`Retrying fetchUTxOByTxHash... [${i + 1}/${retries}]`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        throw err; // errore diverso da 404
      }
    }
  }
  throw new Error(`Transaction ${txHash} not found after ${retries} attempts.`);
}
