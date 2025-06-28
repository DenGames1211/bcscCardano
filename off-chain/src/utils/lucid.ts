import { Lucid, Blockfrost, Data, Script } from 'lucid-cardano';
import betScriptJson from '@/scripts/bet.plutus.json'; // JSON compilato del tuo script Aiken

let lucidInstance: Lucid;

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

// Interfaccia per il Datum della scommessa
export interface BetDatum {
  oracle: string;
  wager: bigint;
  player_1: string;
  player_2: string;
  deadline: bigint;
  is_joined: boolean;
}

type ConstrData = { index: number; fields: any[] };

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
  return lucid.utxosAt(SCRIPT_ADDRESS);
}

/**
 * Converte BetDatum in formato ConstrData per il Datum.
 */
function encodeDatum(d: BetDatum): ConstrData {
  return {
    index: 0,
    fields: [
      d.oracle,
      d.wager,
      d.player_1,
      d.player_2,
      d.deadline,
      d.is_joined
    ]
  };
}

/**
 * Costruisce e invia una transazione che spende/aggiorna l'UTxO sullo script.
 */
async function buildAndSubmit(
  datum: BetDatum,
  redeemer: ConstrData
) {
  const lucid = await initLucid();
  const utxos = await lucid.utxosAt(SCRIPT_ADDRESS);
  const utxo = utxos.find(u => {
    const d = u.datum as BetDatum | null;
    return d && d.oracle === datum.oracle && d.deadline === datum.deadline;
  });
  if (!utxo) throw new Error('UTxO della scommessa non trovato');

  const newDatum = encodeDatum(datum);
  const tx = await lucid
    .newTx()
    .attachSpendingValidator(validatorScript)
    .collectFrom([utxo], Data.to(redeemer))
    .payToContract(
      SCRIPT_ADDRESS,
      Data.to(newDatum),
      { lovelace: datum.wager * 2n }
    )
    .complete();

  const signed = await tx.sign().complete();
  return signed.submit();
}

// -------------------------
// AZIONI SUL VALIDATOR BET
// -------------------------

/** Join: constructor index 0 */
export async function joinBet(d: BetDatum) {
  const redeemer: ConstrData = { index: 0, fields: [d.wager] };
  return buildAndSubmit({ ...d, is_joined: true }, redeemer);
}

/** Win: constructor index 1 */
export async function winBet(d: BetDatum, winner: string) {
  const redeemer: ConstrData = { index: 1, fields: [winner] };
  return buildAndSubmit(d, redeemer);
}

/** Timeout: constructor index 2 */
export async function timeoutBet(d: BetDatum) {
  const redeemer: ConstrData = { index: 2, fields: [] };
  return buildAndSubmit(d, redeemer);
}

/**
 * Deploy: crea un UTxO iniziale presso lo script con il datum iniziale.
 * @param d BetDatum iniziale
 * @param initialAda quantità di lovelace da inviare (default 2 ADA)
 */
export async function deployBetContract(
  d: BetDatum,
  initialAda: bigint = 2_000_000n
) {
  const lucid = await initLucid();
  const datum = encodeDatum(d);
  const tx = await lucid
    .newTx()
    .payToContract(
      SCRIPT_ADDRESS,
      Data.to(datum),
      { lovelace: initialAda }
    )
    .complete();

  const signed = await tx.sign().complete();
  return signed.submit();
}

