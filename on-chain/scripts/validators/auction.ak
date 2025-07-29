use aiken/collection/list
// Types
use aiken/crypto.{Blake2b_224, Hash, VerificationKey, VerificationKeyHash}
use cardano/script_context.{ScriptContext}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
}
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
    _own_ref: OutputReference,
    ctx: ScriptContext,
  ) {
    // this could be the input datum?
    expect Some(datum) = m_datum

    // getting the tx data
    let tx = ctx.transaction
    // tx input
    let own_input = get_own_input(ctx)
    // transaction.input.address
    let contract_address = own_input.output.address
    // 
    let contract_outputs = get_outputs_by_address(tx.outputs, contract_address)

    if redeemer.val == 0 {
      // Redeemer START AUCTION branch
      expect and {
          // checking if the datum seller is the signer
          must_be_signed_by(tx, datum.seller),
          datum.status == 0,
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
          status: 1,
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
        //has_transaction_n_output_addresses(ctx.transaction, 2),
        // Contract has to receive the amount declared in the datum (and the seller takes back the ADA put to create the contract in the previous tx)
        //get_ada_from_outputs(contract_outputs) == contract_output_datum.amount,
        // New contract output must update datum in an expected way:
        contract_output_datum == expected_datum,
      }
    } else if redeemer.val == 1 {
      False
    } else {
      True
    }
  }

  else(_) {
    fail
  }
}
