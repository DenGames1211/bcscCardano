// utils/auction.ts

import {
  mConStr,
  mConStr0,
  mConStr1,
  mConStr2,
  mConStr3,
  Data,
  BlockfrostProvider,
  PlutusData,
} from "@meshsdk/core";

import type { AuctionDatum } from "@/utils/types";

// Constants
export const TEN_MINUTES_MS = 10 * 60 * 1000;

// Blockfrost provider
export const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

/**
 * Auction status enum:
 * 0 = NOT_STARTED
 * 1 = STARTED
 * 2 = OUTBID
 * 3 = ENDED
 */
export enum AuctionStatus {
  NOT_STARTED = 0,
  STARTED = 1,
  OUTBID = 2,
  ENDED = 3,
}

/**
 * Build the Auction Datum.
 *
 * Constructor index: 0
 * Fields:
 *   - seller: ByteString (hex-encoded verification key hash)
 *   - object: ByteString (object identifier or metadata)
 *   - deadline: Integer (POSIX time)
 *   - status: Integer (AuctionStatus)
 *   - bidder: ByteString (current bidder)
 *   - amount: Integer (current bid)
 */
export function makeAuctionDatum(
  seller: string,
  object: string,
  deadline: bigint,
  status: AuctionStatus = AuctionStatus.NOT_STARTED,
  bidder: string,
  amount: bigint
): AuctionDatum {
  return mConStr(0, [
    seller,
    object,
    deadline,
    mConStr(status, []), // ✅ FIXED: status is now a constructor!
    bidder,
    amount,
  ]);
}

/**
 * Redeemer to start the auction
 * Constructor index: 0
 */
export function makeStartRedeemer() {
  return mConStr0([]);
}

/**
 * Redeemer to place a bid
 * Constructor index: 1
 */
export function makeBidRedeemer() {
  return mConStr1([]);
}

/**
 * Redeemer to withdraw a bid (if outbid)
 * Constructor index: 2
 */
export function makeWithdrawRedeemer() {
  return mConStr2([]);
}

/**
 * Redeemer to end the auction
 * Constructor index: 3
 */
export function makeEndRedeemer() {
  return mConStr3([]);
}


