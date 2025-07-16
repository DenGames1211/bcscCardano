// utils/bet.ts


import { mBool, mConStr, mConStr0, BlockfrostProvider, MeshWallet, Integer, mConStr1, mConStr2, VerificationKey } from "@meshsdk/core";
import type { BetDatum } from "@/utils/types";
import {Mint} from '@meshsdk/core';


const FIVE_MINUTES_MS = 5 * 60 * 1000;
const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

/**
 * Build the Bet datum (constructor index 0).
 *
 * @param oracle     – hex-encoded verification key hash of the oracle
 * @param wager      – amount of lovelace (as bigint) each side must lock
 * @param player1    – hex-encoded verification key hash of player 1
 * @param player2    – hex-encoded verification key hash of player 2
 * @param deadline   – POSIXTime (as bigint) after which the oracle may settle
 * @param isJoined   – whether player 2 has already joined (initially false)
 */
export function makeBetDatum(
  oracle: string,
  wager: bigint,
  player1: string,
  player2: string,
  deadline: bigint,
  isJoined: boolean = false
): BetDatum {
  // Mesh-SDK’s Data.Constr(index, fields) builds a Plutus‐style constructor.
  // Bool False is index 0, True is index 1, with no fields.
  const joinedFlag = mConStr(isJoined ? 1: 0, []);

  
  
  return mConStr0([
    oracle,
    wager,
    player1,
    player2,
    deadline,
    joinedFlag,
  ]);
}

export function makeJoinRedeemer(wager: bigint) {
  return mConStr0([wager]);
}

export function makeWinRedeemer(winner: string) {
  return mConStr1([winner]);
}

export function makeTimeoutRedeemer() {
  return mConStr2([]);
}
