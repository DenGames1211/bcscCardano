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
import { deserializePlutusData } from "@meshsdk/core-csl";

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

export function parseAuctionDatum(datumHex: string) {
  const datum = deserializePlutusData(datumHex);
  const constr = datum.as_constr_plutus_data();
  if (!constr) throw new Error('Not a constructor datum');

  const fields = constr.data();

  const sellerBytes = fields.get(0)?.as_bytes();
  const objectBytes = fields.get(1)?.as_bytes();
  const deadlineInt = fields.get(2)?.as_integer()?.as_int();
  const statusTag = fields.get(3)?.as_constr_plutus_data()?.alternative().to_str();
  const highestBidderBytes = fields.get(4)?.as_bytes();
  const highestBidInt = fields.get(5)?.as_integer()?.as_int();

  if (!sellerBytes || !objectBytes || !highestBidderBytes || !statusTag || !deadlineInt || !highestBidInt) {
    throw new Error('Invalid datum structure');
  }

  return {
    seller: Buffer.from(sellerBytes).toString('hex'),
    object: Buffer.from(objectBytes).toString('utf8'),
    deadline: BigInt(deadlineInt.to_str()),
    status: Number(statusTag),
    highestBidder: Buffer.from(highestBidderBytes).toString('hex'),
    highestBid: BigInt(highestBidInt.to_str()),
  };
}
