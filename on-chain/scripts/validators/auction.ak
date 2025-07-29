use aiken/collection/list
// Types
use aiken/crypto.{Blake2b_224, Hash, VerificationKey, VerificationKeyHash}
use cardano/script_context.{ScriptContext}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
}
use cardano/assets.{from_lovelace, lovelace_of}
use utils/auction_utils.{
  Lovelace, POSIXTime, get_ada_from_inputs, get_ada_from_outputs,
  get_inputs_by_vkh, get_outputs_by_address, get_outputs_by_vkh, get_own_input,
  has_transaction_n_output_addresses, must_be_signed_by,
  must_start_before_timeout,
}

pub type Datum {
  seller: Hash<Blake2b_224, VerificationKey>,
  object: ByteArray,
  deadline: POSIXTime,
  status: Int,
  bidder: Hash<Blake2b_224, VerificationKey>,
  amount: Int,
}

pub type Redeemer {
  val: Int,
}

pub fn must_be_signed_by(transaction: Transaction, vk: VerificationKeyHash) {
  list.has(transaction.extra_signatories, vk)
}

validator minimal {
  spend(
    m_datum: Option<Datum>,
    redeemer: Redeemer,
    _input: OutputReference,
    tx: Transaction,
  ) {
    // input datum
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
        status: Int,
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
    // transaction inputs
    let tx_inputs = tx.reference_inputs

    // getting contract outputs
    expect Some(first_input) = list.at(tx.inputs, 0)
    let script_addr = first_input.output.address
    let contract_outputs = get_outputs_by_address(tx.outputs, script_addr)
    
    if redeemer.val == 0 {
      
      // transaction must have only one output
      expect list.length(contract_outputs) == 1
      expect Some(contract_output) = list.head(contract_outputs)
      // getting output datum
      expect InlineDatum(untyped_datum) = contract_output.datum
      expect out_datum: Datum = untyped_datum

      // checking contract input
      let signed_by_seller = list.has(tx.extra_signatories, datum.seller)
      let input_ok = and {
        datum.status == 0, // deploy status must be NOT STARTED
        datum.amount == 0, // amount at creation time must be 0
        signed_by_seller,
      }
      // checking contract output datum 
      let out_datum_ok = and {
        // These must be equal to deploy datum:
        out_datum.object == datum.object,
        out_datum.deadline == datum.deadline,
        out_datum.seller == datum.seller, // the seller must be the one who deployed the contract
        // ------------------------------------------
        // Other checks
        out_datum.seller == out_datum.bidder, // starting bid must be made by the seller
        out_datum.status == 1, // auction status must be STARTED
        out_datum.amount > 0, // starting bid must be greater than 0 ADA
        has_transaction_n_output_addresses(tx, 2),
        // New contract output must update datum in an expected way:
        get_ada_from_outputs(contract_outputs) == out_datum.amount,
      }

      let input_output_ok = and {
        input_ok,
        out_datum_ok,
      }

      input_output_ok?

      // Redeemer START AUCTION branch
      //must_be_signed_by(tx, datum.seller)?
    } else if redeemer.val == 1 {
      // BID branch
      // In both cases (normal bid and raise), there must be one contract's output with a valid higher bid (having STARTED as its status)
        expect Some(contract_bid_output) =
          get_output_by_datum_status(contract_outputs, 1)

        // Checking the datum:
        expect InlineDatum(untyped_bid_datum) = contract_bid_output.datum
        expect bid_datum: Datum = untyped_bid_datum

        // transaction must be signed by the bidder
        let signed_by_bidder = list.has(tx.extra_signatories, datum.bidder)
        // checking transaction's inputs validity
        let bid_input_ok = and {
            signed_by_bidder,
            // checking the deadline (TODO)

            // inputs must refere to a transaction with status STARTED
            datum.status == 1,
        }

        let bid_datum_ok = and {
            // these must not change
            bid_datum.seller == datum.seller,
            bid_datum.object == datum.object,
            // ** suspected fail 
            //bid_datum.deadline == datum.deadline,
            // status must be STARTED again
            bid_datum.status == 1,
            // bid amount must be higher than the starting bid made by the seller
            bid_datum.amount > datum.amount

        }

        let bid_input_output_ok = and {
          bid_input_ok,
          bid_datum_ok,
          // ** suspected fail
          //lovelace_of(contract_bid_output.value) == bid_datum.amount,
        }

        bid_input_output_ok?
        // OUTBID logic (TODO)
    } else if redeemer.val == 2{
      // WITHDRAW Logic

      let signed_by_bidder = list.has(tx.extra_signatories, datum.bidder)
      // check inputs
      let wd_input_ok = and {
        signed_by_bidder,
        // input datum status check
        datum.status == 1 // bidder can withdraw for STARTED auctions only
      }

      // Withdrawer must receive the correct amount
      let withdrawer_inputs = get_inputs_by_vkh(tx.inputs, datum.bidder)
      let withdrawer_outputs = get_outputs_by_vkh(tx.outputs, datum.bidder)

      let wd_output_ok = and {
         // Withdrawer's new balance must be their previous one plus the ADA they're gonna receive back minus the tx's fees
        get_ada_from_outputs(withdrawer_outputs) == get_ada_from_inputs(
          withdrawer_inputs,
        ) + datum.amount - tx.fee,
        // Contract must not receive nothing back
            list.length(contract_outputs) == 0,
      }

      let wd_input_output_ok = and {
        wd_input_ok,
        wd_output_ok,
      }

      wd_input_output_ok?


    } else if redeemer.val == 3 {
      // END branch

      let signed_by_seller = list.has(tx.extra_signatories, datum.seller)
      // There's not need to check the seller's new balance (seller also has to pay a minimum amount to ADA to the contract whilst creating the new output...)
      expect Some(contract_end_output) =
          get_output_by_datum_status(contract_outputs, 3)
      // Checking the datum:
      expect InlineDatum(untyped_contract_datum) = contract_end_output.datum
      expect end_datum: Datum = untyped_contract_datum
    
      let end_input_ok = and {
        // Only auctions with STARTED status can be closed
        datum.status == 1,
        signed_by_seller,
      }

      //let end_output_ok = and {
        //Contract must receive an output with the ENDED status
        //list.length(contract_outputs) == 1,
        
        // TODO check the deadline: deadline must be expired
      //}

      let end_output_ok = list.length(contract_outputs) == 1

      let end_datum_ok = and {
        // only the original seller can close the auction
        end_datum.seller == datum.seller,
        // these must not change either
        end_datum.object == datum.object,
        end_datum.deadline == datum.deadline,
        // new datum status must be ENDED
        end_datum.status == 3,
      }

      let end_input_output_ok = and {
        end_input_ok,
        end_datum_ok,
        end_output_ok,
      }

      end_input_output_ok?

    } else {
      True
    }
  }

  else(_) {
    fail
  }
}
