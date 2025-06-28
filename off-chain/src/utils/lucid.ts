import { Lucid, Blockfrost, Data, Script, fromHex, Address } from 'lucid-cardano';
import betScriptJson from '@/scripts/bet.plutus.json'; // JSON compilato
import { BetBetSpend } from "@/scripts/bet.plutus";
import type { BetDatum, BetRedeemer } from '@/scripts/bet.plutus';

let lucidInstance: Lucid;
let validatorAddress: Address;

// Configura il provider Blockfrost
const BLOCKFROST_URL = process.env.NEXT_PUBLIC_BLOCKFROST_NETWORK_URL || 'https://cardano-preview.blockfrost.io/api/v0';
const BLOCKFROST_KEY = process.env.NEXT_PUBLIC_BLOCKFROST_KEY!;

// Indirizzo del tuo script Aiken (derivato dal Plutus script hash)
export const SCRIPT_ADDRESS = process.env.NEXT_PUBLIC_SCRIPT_ADDRESS!;

// Costruisci un oggetto Script leggendo dal JSON
const validatorScript: Script = {
  type: betScriptJson.type as Script['type'],
  script: betScriptJson.cborHex
};

/** Bech32 → payment key hash (hex string senza 0x) */
function getHashHexFromAddress(addr: string): string {
  const details = lucidInstance.utils.getAddressDetails(addr);
  const hash = details.paymentCredential?.hash;
  if (!hash) throw new Error('Impossibile estrarre paymentCredential.hash');
  return hash.replace(/^0x/, '');
}

export function encodeDatum(d: BetDatum): string {
  // 1) Estrai gli hash in hex (56 char) da ogni Bech32
  const oracleHex = getHashHexFromAddress(d.oracle);
  const p1Hex = getHashHexFromAddress(d.player_1);
  const p2Hex = getHashHexFromAddress(d.player_2);

  // 2) Costruisci l'oggetto conforme al JSON-schema
   const shaped = {
    index: 0, // Matches the Datum constructor in your schema
    fields: [
      oracleHex,    // aiken/crypto/VerificationKeyHash
      d.wager,      // utils/bet_utils/Lovelace
      p1Hex,        // aiken/crypto/VerificationKeyHash
      p2Hex,        // aiken/crypto/VerificationKeyHash
    ]
  } as any;

  // 3) Serializza col JSON-schema Aiken
  return Data.to(shaped, BetBetSpend.datum);
}

/** serializza il tuo redeemer (Join, Win, Timeout) */
export function encodeRedeemer(r: BetRedeemer): string {
  return Data.to(r, BetBetSpend.redeemer);
}

/**
 * Inizializza Lucid e wallet (solo browser).
 */
export async function initLucid(): Promise<Lucid> {
  if (!lucidInstance) {
    const provider = new Blockfrost(BLOCKFROST_URL, BLOCKFROST_KEY);
    lucidInstance = await Lucid.new(provider, 'Preview');
    if (typeof window !== 'undefined' && window.cardano) {
      // Trova il wallet Lace o Nami compatibile
      const wallet = window.cardano.lace || window.cardano.nami || Object.values(window.cardano).find((w: any) => w.name === 'Nami' || w.name === 'Lace');
      
      if (!wallet) throw new Error('Wallet compatibile non trovato');

      const api = await wallet.enable();

      validatorAddress = lucidInstance.utils.validatorToAddress(
        validatorScript,
      );
      lucidInstance.selectWallet(api);
    }
  }
  return lucidInstance;
}

/**
 * Recupera tutti gli UTxO dal tuo script address.
 */
export async function getScriptUtxos() {
  const lucid = await initLucid();
  return lucid.utxosAt(validatorAddress);
}

const Listing = Data.Object({
  owner: Data.Bytes(),
  amount: Data.Integer(),
  private: Data.Boolean(),
});
type Listing = typeof Listing;

/**
 * Costruisce e invia una transazione che spende/aggiorna l'UTxO sullo script.
 */
async function buildAndSubmit(
  datum: BetDatum,
  redeemer: BetRedeemer
) {
  const lucid = await initLucid();
  const utxos = await lucid.utxosAt(validatorAddress);
  const utxo = utxos.find(u => {
    const d = u.datum as BetDatum | null;
    return d && d.oracle === datum.oracle && d.deadline === datum.deadline;
  });
  if (!utxo) throw new Error('UTxO della scommessa non trovato');

  const newDatum = encodeDatum(datum);
  const tx = await lucid
  .newTx()
  .attachSpendingValidator(validatorScript)
  .collectFrom([utxo], encodeRedeemer(redeemer))
  .payToContract(
    validatorAddress,
    encodeDatum(datum),
    { lovelace: datum.wager * 2n }
  )
  .complete();
}

// -------------------------
// AZIONI SUL VALIDATOR BET
// -------------------------

/** Join: constructor index 0 */
export async function joinBet(d: BetDatum) {
  const redeemer: BetRedeemer = { Join: { wager: d.wager } };
  // buildAndSubmit ora deve accettare la stringa serializzata
  return buildAndSubmit({ ...d, isJoined: true }, redeemer);
}

/** Win: constructor index 1 */
export async function winBet(d: BetDatum, winner: string) {
  const redeemer: BetRedeemer = { Win: { winner } };
  return buildAndSubmit(d, redeemer);
}

/** Timeout: constructor index 2 */
export async function timeoutBet(d: BetDatum) {
  const redeemer: BetRedeemer = "Timeout";
  return buildAndSubmit(d, redeemer);
}

/**
 * Deploy: crea un UTxO iniziale presso lo script con il datum iniziale.
 * @param d BetDatum iniziale
 * @param initialAda quantità di lovelace da inviare (default 2 ADA)
 */
export async function deployBetContract(d: BetDatum, initialAda = 2_000_000n) {
  const lucid = await initLucid();
  console.log(d);

  const tx = await lucid
    .newTx()
    .attachSpendingValidator(validatorScript)
    .payToContract(
      validatorAddress,
      encodeDatum(d),
      { lovelace: initialAda }
    )
    .complete();

  const signed = await tx.sign().complete();
  return signed.submit();
}


