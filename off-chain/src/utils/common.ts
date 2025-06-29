import fs from "node:fs";
import {
  Asset,
  BlockfrostProvider,
  BrowserWallet,
  mConStr0,
  MeshTxBuilder,
  MeshWallet,
  serializePlutusScript,
  UTxO,
} from "@meshsdk/core";
import { applyParamsToScript } from "@meshsdk/core-csl";
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