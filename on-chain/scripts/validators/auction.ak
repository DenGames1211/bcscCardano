// Suggested stdlib version: 2.2.0 (https://github.com/aiken-lang/stdlib/releases/tag/2.2.0)

// ////////////////////////////////////////////////////////////////////////////////

// ////////////////////////////////////////////////////////////////////////////////

// ////////////////////////////////////////////////////////////////////////////////
// Imports:
// ////////////////////////////////////////////////////////////////////////////////

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite, Interval, IntervalBound}
//use aiken/transaction
use cardano/address.{Address, VerificationKey}
use cardano/assets.{from_lovelace, lovelace_of}
use cardano/script_context.{ScriptContext, Spending}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
}
// use cardano/transaction/value
// use aiken/cbor // diagnostic

use utils/auction_utils.{
  Lovelace, POSIXTime, get_ada_from_inputs, get_ada_from_outputs,
  get_inputs_by_vkh, get_outputs_by_address, get_outputs_by_vkh, get_own_input,
  has_transaction_n_output_addresses, must_be_signed_by,
  must_start_before_timeout,
}

// ////////////////////////////////////////////////////////////////////////////////

// ////////////////////////////////////////////////////////////////////////////////
// Types: 
// ////////////////////////////////////////////////////////////////////////////////

/// Similar problem here: 
/// https://plutus-pioneer-program.readthedocs.io/en/latest/pioneer/week1.html#the-english-auction-contract
/// Partecipants
///     - Alice                                  // seller
///     - Others (Bob, Charlie, Diane, Eve, ...) // bidders
/// Transactions
///     - auction-create
///     - auction-start
///     - auction-bid (bids and raises)
///     - auction-withdraw
///     - auction-end
/// Contract states
///     - NOT_STARTED
///     - STARTED
///     - OUTBID
///     - ENDED
/// Execution traces
///
///     - Trace 1
///
///         Alice:      *creates the auction*
///                     inputs  = [...]
///                     outputs = [UTXO_AUCTION_000 w/ status=NOT_STARTED|(Alice, 0)]
///
///         Alice:      *starts the auction with a 100 ADA starting bid*
///                     inputs  = [UTXO_AUCTION_000, 100_ADA]
///                     outputs = [UTXO_AUCTION_100 w/ status=STARTED|(Alice, 100)]
///
///         Bob:        *bids 200 ADA*
///                     inputs  = [UTXO_AUCTION_100, 200_ADA]
///                     outputs = [UTXO_AUCTION_200 w/ status=STARTED|(Bob,200), UTXO_RETURN_100 to the contract w/ status=OUTBID]
///
///         Charlie:    *bids 300 ADA*
///                     inputs  = [UTXO_AUCTION_200, 300_ADA]
///                     outputs = [UTXO_AUCTION_300 w/ status=STARTED|(Charlie, 300), UTXO_RETURN_200 to the contract w/ status=OUTBID)
///
///         Alice:      *withdraws her 100 ADA starting bid*
///                     inputs  = [UTXO_RETURN_100]
///                     outputs = [UTXO_ALICE_100]
///
///         Bob:        *withdraws his 200 ADA bid*
///                     inputs  = [UTXO_RETURN_200] 
///                     outputs = [UTXO_BOB_200]
///
///         Bob:        *bids 400 ADA*
///                     inputs  = [UTXO_AUCTION_300, 400_ADA]
///                     outputs = [UTXO_AUCTION_400 w/ status=STARTED|(Bob, 400), UTXO_RETURN_300 to the contract w/ status=OUTBID)
///
///         Bob:        *raises to 500 ADA*
///                     inputs  = [UTXO_AUCTION_400, 500_ADA]
///                     outputs = [UTXO_AUCTION_500 w/ status=STARTED|(Bob, 500), UTXO_BOB_400 to Bob himself)
///
///         *deadline*
///
///         Alice:      *closes the the auction*
///                     inputs  = [UTXO_AUCTION_400]
///                     outputs = [UTXO_ALICE_400, UTXO_AUCTION_ENDED w/ status=ENDED|(Bob, 400)]
///
///         Charlie:    *withdraws his 300 ADA bid*
///                     inputs  = [UTXO_RETURN_300]
///                     outputs = [UTXO_CHARLIE_300]
///
///
///        - Trace 2
///
///         Alice:      *creates the auction*
///                     inputs  = [...]
///                     outputs = [UTXO_AUCTION_000 w/ status=NOT_STARTED|(Alice, 0)]
///
///         Alice:      *starts the auction with a 100 ADA starting bid*
///                     inputs  = [UTXO_AUCTION_000, 100_ADA]
///                     outputs = [UTXO_AUCTION_100 w/ status=STARTED|(Alice, 100)]
///
///         *deadline*
///
///         Alice:      *closes the auction*
///                     inputs  = [UTXO_AUCTION_100]
///                     outputs = [UTXO_ALICE_100, UTXO_AUCTION_ENDED w/ status=ENDED|(Alice, 100)]
///
pub type Datum {
  seller: VerificationKeyHash,
  object: ByteArray,
  deadline: POSIXTime,
  status: Status,
  bidder: VerificationKeyHash,
  amount: Int,
}

pub type Redeemer {
  Start
  Bid
  Withdraw
  End
}

pub type Status {
  NOT_STARTED
  STARTED
  OUTBID
  ENDED
}

// ////////////////////////////////////////////////////////////////////////////////

// ////////////////////////////////////////////////////////////////////////////////
// Helping functions and validator:
// ////////////////////////////////////////////////////////////////////////////////

validator auction {
  spend(
    m_datum: Option<Datum>,
    redeemer: Redeemer,
    _own_ref: OutputReference,
    ctx: ScriptContext,
  ) {
    expect Some(datum) = m_datum
    let get_output_by_datum_status =
      fn(
        /// ***
        /// @funct get_output_by_datum_status
        /// @brief - Returns from the outputs list, the (first) one having its datum.status field equal to the status passed as parameter
        /// @param outputs
        /// @param status
        /// @return Option<Output> - The first found output (if it exists) with its datum having status as its status
        /// ***
        outputs: List<Output>,
        status: Status,
      ) {
        list.find(
          outputs,
          fn(o) {
            expect InlineDatum(untyped_datum) = o.datum
            expect typed_datum: Datum = untyped_datum

            typed_datum.status == status
          },
        )
      }

    let tx = ctx.transaction
    let own_input = get_own_input(ctx)
    let contract_address = own_input.output.address

    let contract_outputs = get_outputs_by_address(tx.outputs, contract_address)

    when redeemer is {
      Start -> {
        expect and {
            must_be_signed_by(tx, datum.seller),
            // Seller can start the auction iff the status is NOT_STARTED
            datum.status == NOT_STARTED,
            // Seller cannot start the auction if the deadline has already been reached
            must_start_before_timeout(
              ctx.transaction.validity_range,
              datum.deadline,
            ),
          }
        // Contract must have only one output
        expect list.length(contract_outputs) == 1
        expect Some(contract_output) = list.at(contract_outputs, 0)

        // Checking the datum:
        expect InlineDatum(untyped_datum) = contract_output.datum
        expect contract_output_datum: Datum = untyped_datum

        let expected_datum =
          Datum {
            // These must not change:
            seller: datum.seller,
            object: datum.object,
            deadline: datum.deadline,
            // These ones have to change:
            status: STARTED,
            // new output must change its status to STARTED
            bidder: datum.seller,
            // current bidder must be the seller as well
            amount: contract_output_datum.amount,
          }

        and {
          // A correct empty auction contract must have its initialization amount set to 0
          datum.amount == 0,
          // The amount must be greater than 0
          contract_output_datum.amount > 0,
          // We expect 2 output addresses: seller and contract
          has_transaction_n_output_addresses(ctx.transaction, 2),
          // Contract has to receive the amount declared in the datum (and the seller takes back the ADA put to create the contract in the previous tx)
          get_ada_from_outputs(contract_outputs) == contract_output_datum.amount,
          // New contract output must update datum in an expected way:
          contract_output_datum == expected_datum,
        }
      }

      Bid -> {
        // In both cases (normal bid and raise), there must be one contract's output with a valid higher bid (having STARTED as its status)
        expect Some(contract_bid_output) =
          get_output_by_datum_status(contract_outputs, STARTED)

        // Checking the datum:
        expect InlineDatum(untyped_bid_datum) = contract_bid_output.datum
        expect contract_bid_output_datum: Datum = untyped_bid_datum

        let expected_bid_datum =
          Datum {
            // These must not change:
            seller: datum.seller,
            object: datum.object,
            deadline: datum.deadline,
            // These ones have to change:
            status: STARTED,
            // new auction output must continue to have STARTED status
            bidder: contract_bid_output_datum.bidder,
            // in the event of a raise, this remains the same
            amount: contract_bid_output_datum.amount,
          }

        expect and {
            // Transaction must be signed by the new bidder declared in the datum
            must_be_signed_by(tx, contract_bid_output_datum.bidder),
            // One can bid only if the auction's UTXO has STARTED status
            datum.status == STARTED,
            // We accept a new bid if the deadline has not already been reached
            must_start_before_timeout(
              ctx.transaction.validity_range,
              datum.deadline,
            ),
            // Auction output must have an expected datum
            contract_bid_output_datum == expected_bid_datum,
            // New bid must be higher than the previous one
            contract_bid_output_datum.amount > datum.amount,
            // Contract must receive the correct new bid amount
            lovelace_of(contract_bid_output.value) == contract_bid_output_datum.amount,
          }
        // A normal bid is the one having the new bidder different from the previous one
        if contract_bid_output_datum.bidder != datum.bidder {
          // Contract must own two new outputs. We've already taken the contract_bid_output
          expect list.length(contract_outputs) == 2
          // The other output with an outbid bid (this one has to be returned to the old bidder)
          expect Some(contract_withdraw_output) =
            get_output_by_datum_status(contract_outputs, OUTBID)

          // Checking the datum:
          expect InlineDatum(untyped_withdraw_datum) =
            contract_withdraw_output.datum
          expect contract_withdraw_output_datum: Datum = untyped_withdraw_datum

          let expected_withdraw_datum =
            Datum {
              // These must not change:
              seller: datum.seller,
              object: datum.object,
              deadline: datum.deadline,
              // These ones have to change:
              status: OUTBID,
              // new output to be returned to the old bidder must be marked as OUTBID
              bidder: datum.bidder,
              // we return the amount to the previous bidder (i.e. the actual higher before this tx)
              amount: datum.amount,
            }

          and {
            // Outbid output must have the expected datum
            contract_withdraw_output_datum == expected_withdraw_datum,
            // Contract must receive the correct outbid amount to be returned as well
            lovelace_of(contract_withdraw_output.value) == contract_withdraw_output_datum.amount,
          }
        } else {
          // Raises
          // Contract must own only one new output (the auction one)
          expect list.length(contract_outputs) == 1
          // Bidder must receive their old bid back
          let bidder_inputs = get_inputs_by_vkh(tx.inputs, datum.bidder)
          let bidder_outputs = get_outputs_by_vkh(tx.outputs, datum.bidder)

          // Bidder's new balance must be their previous one plus the ADA they're gonna receive back, minus the new bid, minus the tx's fees they're paying
          get_ada_from_outputs(bidder_outputs) == get_ada_from_inputs(
            bidder_inputs,
          ) + datum.amount - contract_bid_output_datum.amount - tx.fee
        }
      }
      Withdraw -> {
        expect and {
            // The old bidder trying to withdraw must sign the transaction
            must_be_signed_by(tx, datum.bidder),
            // One can withdraw iff the UTXO's status is OUTBID
            datum.status == OUTBID,
            // Contract must not receive nothing back
            list.length(contract_outputs) == 0,
          }

        // Withdrawer must receive the correct amount
        let withdrawer_inputs = get_inputs_by_vkh(tx.inputs, datum.bidder)
        let withdrawer_outputs = get_outputs_by_vkh(tx.outputs, datum.bidder)

        // Withdrawer's new balance must be their previous one plus the ADA they're gonna receive back minus the tx's fees
        get_ada_from_outputs(withdrawer_outputs) == get_ada_from_inputs(
          withdrawer_inputs,
        ) + datum.amount - tx.fee
      }

      End -> {
        expect and {
            // The seller must sign the tx
            must_be_signed_by(tx, datum.seller),
            // The auction can be closed only after the deadline
            !must_start_before_timeout(
              ctx.transaction.validity_range,
              datum.deadline,
            ),
            // Only auctions with STARTED status can be closed
            datum.status == STARTED,
            // Contract must receive an output with the ENDED status
            list.length(contract_outputs) == 1,
          }

        // There's not need to check the seller's new balance (seller also has to pay a minimum amount to ADA to the contract whilst creating the new output...)
        expect Some(contract_output) = list.at(contract_outputs, 0)

        // Checking the datum:
        expect InlineDatum(untyped_contract_datum) = contract_output.datum
        expect contract_output_datum: Datum = untyped_contract_datum

        let expected_ended_datum =
          Datum {
            seller: datum.seller,
            object: datum.object,
            deadline: datum.deadline,
            status: ENDED,
            // only status has to change
            bidder: datum.bidder,
            amount: datum.amount,
          }
        // Contract's new output must have the expected datum
        contract_output_datum == expected_ended_datum
      }
    }
  }

  else(_ctx: ScriptContext) {
    False
  }
}

// ////////////////////////////////////////////////////////////////////////////////
// Test:
// ////////////////////////////////////////////////////////////////////////////////

test auction_start() {
  // 1) Seller & auction parameters
  let seller: VerificationKeyHash = #"01"
  let deadline: POSIXTime = 1_000_000
  let min_bid: Lovelace = 0
  let new_bid: Lovelace = 5_000_000
  let validity_range: Interval<POSIXTime> =
    Interval {
      lower_bound: IntervalBound { bound_type: Finite(0), is_inclusive: True },
      upper_bound: IntervalBound {
        bound_type: Finite(999_999),
        //bound_type: PositiveInfinity,
        is_inclusive: False,
      },
    }
  //let tx = ctx.transaction
  // 2) Initial datum: auction not started
  let initial_datum: Datum =
    Datum {
      seller,
      object: "NFT1",
      deadline,
      status: NOT_STARTED,
      bidder: seller,
      amount: min_bid,
    }

  // 3) Redeemer
  let redeemer: Redeemer = Start

  // 4) Placeholder UTXO (referenced by the validator)
  let placeholder_utxo: OutputReference =
    OutputReference { transaction_id: "start", output_index: 0 }

  // 5) Contract address
  let contract_address: Address =
    Address {
      payment_credential: VerificationKey(seller),
      stake_credential: None,
    }

  // 6) Contract input UTXO (auction not yet started)
  let contract_input: Input =
    Input {
      output_reference: placeholder_utxo,
      output: Output {
        address: contract_address,
        value: from_lovelace(min_bid),
        datum: InlineDatum(initial_datum),
        reference_script: None,
      },
    }

  // 7) Contract output UTXO (auction just started)
  let started_datum: Datum =
    Datum { ..initial_datum, status: STARTED, bidder: seller, amount: new_bid }

  let contract_output: Output =
    Output {
      address: contract_address,
      value: from_lovelace(new_bid),
      datum: InlineDatum(started_datum),
      reference_script: None,
    }

  // 7b) Refund/change back to seller
  let change_key: VerificationKeyHash = #"02"
  let change_address: Address =
    Address {
      payment_credential: VerificationKey(change_key),
      stake_credential: None,
    }

  let seller_output: Output =
    Output {
      address: change_address,
      value: from_lovelace(0),
      datum: NoDatum,
      reference_script: None,
    }

  // 8) Build the transaction
  let tx: Transaction =
    Transaction {
      ..transaction.placeholder,
      inputs: [contract_input],
      outputs: [contract_output, seller_output],
      fee: 0,
      extra_signatories: [seller],
      validity_range: validity_range,
    }

  // 9) Wrap in ScriptContext
  let ctx: ScriptContext =
    ScriptContext {
      transaction: tx,
      redeemer,
      info: Spending { output: placeholder_utxo, datum: None },
    }

  // 🔍 Call the validator
  auction.spend(Some(initial_datum), redeemer, placeholder_utxo, ctx)
}
