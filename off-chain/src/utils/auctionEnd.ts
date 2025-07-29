import {
  BlockfrostProvider,
  deserializeAddress,
  mConStr0,
  MeshTxBuilder,
  UTxO,
} from '@meshsdk/core';
import {
  AuctionStatus,
  makeAuctionDatum,
  makeEndRedeemer,
  parseAuctionDatum,
} from '@/utils/auction';
import { getBrowserWallet, getAuctionScript } from '@/utils/common';
import { Address } from '@emurgo/cardano-serialization-lib-asmjs';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

/**
 * Helper per convertire un PubKeyHash in indirizzo bech32 su mainnet.
 */


export async function handleEndAuction(
  seller: string,
  object: string,
  deadline: bigint
) {
  const wallet = await getBrowserWallet();
  const [addr] = await wallet.getUsedAddresses();
  const sellerHash = deserializeAddress(seller).pubKeyHash;
  const sellerUtxos = await wallet.getUsedUTxOs();
  const callerHash = deserializeAddress(addr).pubKeyHash;
  const sellerPKH = deserializeAddress(seller).pubKeyHash;
  if (callerHash !== sellerHash) {
    throw new Error('Only the seller can end this auction.');
  }

  const now = BigInt(Date.now());
  if (now < deadline) {
    console.log("Now: ", now, " deadline: ", deadline);
    throw new Error('Auction deadline not reached yet.');
  }

  const { scriptAddr, scriptCbor } = getAuctionScript();

  // Fetch all UTxOs at script address
  const scriptUtxos = await provider.fetchAddressUTxOs(scriptAddr);
  const walletUtxos = await wallet.getUtxos();

  for (const utxo of scriptUtxos) {
    if (!utxo.output.plutusData) continue;

    try {
      const datum = parseAuctionDatum(utxo.output.plutusData);
      console.log("datum controllato: ", datum);
      console.log("variables: ", object, deadline, sellerPKH);
      if (
        datum.status != 1n // only started auctions can be ended
      )
        continue;

      if (
        datum.object !== object ||
        datum.deadline !== deadline ||
        datum.seller !== sellerPKH
      )
        continue;

      const newDatum = makeAuctionDatum(
        datum.seller,
        datum.object,
        datum.deadline,
        3n,
        datum.highestBidder,
        datum.highestBid
      );

      console.log("new datum: ", newDatum);

      const sellerAddress = seller;
      const redeemer = mConStr0([3]);

      const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

      txBuilder
        .spendingPlutusScriptV3()
        .txIn(
          utxo.input.txHash,
          utxo.input.outputIndex
        )
        .txInInlineDatumPresent()
        .txInRedeemerValue(redeemer)
        .txInScript(scriptCbor)
        .txInCollateral(
          walletUtxos[0].input.txHash,
          walletUtxos[0].input.outputIndex
        )

        .txOut(sellerAddress, [
          { unit: 'lovelace', quantity: datum.highestBid.toString() },
        ])
        .txOut(scriptAddr, [{ unit: 'lovelace', quantity: "2000000" },])
        .txOutInlineDatumValue(newDatum)

      const unsignedTx = await txBuilder
        .selectUtxosFrom(walletUtxos)
        .changeAddress(sellerAddress)
        .requiredSignerHash(sellerPKH)
        .complete();

      const signedTx = await wallet.signTx(unsignedTx, true);
      const txHash = await wallet.submitTx(signedTx);

      console.log("end ok, tx hash: ", txHash);
      return txHash;

    } catch (err) {
      console.warn('Skipping UTxO due to parsing error or mismatch.', err);
      continue;
    }
  }

  throw new Error('No valid auction UTxO found for given object and deadline.');
}
