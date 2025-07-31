// Suggested stdlib version: 2.2.0 (https://github.com/aiken-lang/stdlib/releases/tag/1.7.0)

// ////////////////////////////////////////////////////////////////////////////////
// Imports:
// ////////////////////////////////////////////////////////////////////////////////

use aiken/collection/list
use aiken/crypto.{Blake2b_224, Hash, VerificationKey, VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/address.{Address}
use cardano/assets.{from_lovelace}
use cardano/script_context.{ScriptContext, Spending}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
}
use utils/bet_utils.{
  Lovelace, POSIXTime, get_ada_from_inputs, get_ada_from_outputs,
  get_inputs_by_address, get_inputs_by_vkh, get_outputs_by_address,
  get_outputs_by_vkh, get_own_input,
}

// ////////////////////////////////////////////////////////////////////////////////
// Types:
// ////////////////////////////////////////////////////////////////////////////////

pub type Datum {
  oracle: Hash<Blake2b_224, VerificationKey>,
  wager: Int,
  player_1: Hash<Blake2b_224, VerificationKey>,
  player_2: Hash<Blake2b_224, VerificationKey>,
  deadline: POSIXTime,
  is_joined: Int,
}

pub type Redeemer {
  branch: Int,
  winner: Hash<Blake2b_224, VerificationKey>,
}

// 0 = Join, 1 = Win, 2 = Timeout
//wager: Int,
// relevant only if branch == 0
//winner: Hash<Blake2b_224, VerificationKey>,

// relevant only if branch == 1

// ////////////////////////////////////////////////////////////////////////////////
// Validator:
// ////////////////////////////////////////////////////////////////////////////////

validator bet {
  spend(
    m_datum: Option<Datum>,
    redeemer: Redeemer,
    _input: OutputReference,
    tx: Transaction,
  ) {
    // Extract previous state datum
    expect Some(datum) = m_datum

    // transaction inputs
    let contract_inputs = tx.reference_inputs

    // Compute transaction earliest valid time
    //let tx_earliest_time =
    //  when tx.validity_range.lower_bound.bound_type is {
    //    Finite(x) -> x
    //    _ -> 0
    //  }
    // getting contract outputs
    expect Some(first_input) = list.at(tx.inputs, 0)
    let script_addr = first_input.output.address
    let contract_outputs = get_outputs_by_address(tx.outputs, script_addr)

    let contract_inputs_balance = get_ada_from_inputs(contract_inputs)
    let contract_outputs_balance = get_ada_from_outputs(contract_outputs)

    if redeemer.branch == 0 {
      // JOIN LOGIC

      // transaction must have only one output
      expect list.length(contract_outputs) == 1
      expect Some(contract_output) = list.head(contract_outputs)

      // Getting the output's datum
      expect InlineDatum(untyped_datum) = contract_output.datum
      expect join_datum: Datum = untyped_datum
      // checking signatories
      let is_signed_by_p1 = list.has(tx.extra_signatories, join_datum.player_1)
      let is_signed_by_p2 = list.has(tx.extra_signatories, join_datum.player_2)
      // Players balances
      let player_1_inputs_balance =
        get_ada_from_inputs(get_inputs_by_vkh(tx.inputs, datum.player_1))
      let player_1_outputs_balance =
        get_ada_from_outputs(get_outputs_by_vkh(tx.outputs, datum.player_1))
      let player_2_inputs_balance =
        get_ada_from_inputs(get_inputs_by_vkh(tx.inputs, datum.player_2))
      let player_2_outputs_balance =
        get_ada_from_outputs(get_outputs_by_vkh(tx.outputs, datum.player_2))

      let join_input_ok = and {
          // checking the deadline: TODO
          // deadline > tx_earliest_time 
          // both player must sign the transaction
          is_signed_by_p1,
          is_signed_by_p2,
          // status must be NOT JOINED
          datum.is_joined == 0,
          // wager must be > 0
          datum.wager > 0,
        }

      let join_datum_ok = and {
          join_datum.player_1 == datum.player_1,
          // player 1 and player 2 must be different
          join_datum.player_1 != join_datum.player_2,
          // oracle must be the same
          join_datum.oracle == datum.oracle,
          // oracle must not be one of the player
          join_datum.oracle != join_datum.player_1,
          join_datum.oracle != join_datum.player_2,
          // now, status must be JOINED
          join_datum.is_joined == 1,
          // wager must be the same for each player
          join_datum.wager == datum.wager,
        }
      //
      let join_output_ok = and {
          // Correct total wager amount
          contract_outputs_balance - contract_inputs_balance == join_datum.wager * 2,
          // Players are paying wager and fees correctly (player 1 only pays the fees) 
          player_1_outputs_balance == player_1_inputs_balance - join_datum.wager - tx.fee,
          player_2_outputs_balance == player_2_inputs_balance - join_datum.wager,
        }

      let input_output_ok = and {
          join_input_ok,
          join_datum_ok,
          join_output_ok,
        }
      //join_output_ok,
      input_output_ok?
      //join_input_ok?
      True
    } else if redeemer.branch == 1 {
      // WIN Branch
      let winner = redeemer.winner
      // getting the winner from the redeemer 
      // transaction must have only one output
      expect list.length(contract_outputs) == 1
      expect Some(contract_output) = list.head(contract_outputs)

      // getting output datum
      expect InlineDatum(untyped_datum) = contract_output.datum
      expect win_datum: Datum = untyped_datum

      let signed_by_oracle = list.has(tx.extra_signatories, datum.oracle)
      let win_input_ok = and {
          // oracle must sign the transaction
          signed_by_oracle,
          // datum input status must be JOINED
          datum.is_joined == 1,
          // checking deadline (TODO)

          // Oracle chooses a valid winner
          or {
            winner == datum.player_1,
            winner == datum.player_2,
          },
        }

      let win_input_output_ok = and {
          win_input_ok,
          // datum must not change
          win_datum.winner != datum.winner,
          // Winner receives the pot 
          get_ada_from_outputs(get_outputs_by_vkh(tx.outputs, winner)) == datum.wager * 2,
        }

      win_input_output_ok?
    } else if redeemer.val == 2 {
      // timeout branch
      //expect list.length(contract_outputs) == 1
      expect Some(contract_output) = list.head(contract_outputs)

      // Getting the output's datum
      expect InlineDatum(untyped_datum) = contract_output.datum
      expect timeout_datum: Datum = untyped_datum
      // checking signatories
      let is_signed_by_p1 = list.has(tx.extra_signatories, datum.player_1)
      let is_signed_by_p2 = list.has(tx.extra_signatories, datum.player_2)

      let player_1_inputs_balance =
        get_ada_from_inputs(get_inputs_by_vkh(tx.inputs, player_1))
      let player_1_outputs_balance =
        get_ada_from_outputs(get_outputs_by_vkh(tx.outputs, player_1))

      let player_2_inputs_balance =
        get_ada_from_inputs(get_inputs_by_vkh(tx.inputs, player_2))
      let player_2_outputs_balance =
        get_ada_from_outputs(get_outputs_by_vkh(tx.outputs, player_2))

      let timeout_ok = and {
          datum.status == 1,
          timeout_datum.player_1 == datum.player_1,
          timeout_datum.player_2 == datum.player_2,
          player_1_outputs_balance == player_1_inputs_balance + datum.wager - tx.fee,
          player_2_outputs_balance == player_2_inputs_balance + datum.wager,
        }

      timeout_ok?
    } else {
      True
    }
  }

  else(_) {
    fail
  }
}
// ////////////////////////////////////////////////////////////////////////////////
// Test:
// ////////////////////////////////////////////////////////////////////////////////
