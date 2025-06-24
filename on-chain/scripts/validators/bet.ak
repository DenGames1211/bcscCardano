// Suggested stdlib version: 1.7.0 (https://github.com/aiken-lang/stdlib/releases/tag/1.7.0)

// ////////////////////////////////////////////////////////////////////////////////
// Imports:
// ////////////////////////////////////////////////////////////////////////////////

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{Transaction, OutputReference, InlineDatum, Input, Output, NoDatum}
use cardano/script_context.{ScriptContext, Spending}
use cardano/address.{Address, VerificationKey}
use cardano/assets.{from_lovelace}
use aiken/interval.{Finite}

use utils/bet_utils.{
    POSIXTime,
    Lovelace,
    get_own_input,
    get_inputs_by_address,
    get_outputs_by_address,
    get_ada_from_inputs,
    get_ada_from_outputs,
    get_inputs_by_vkh,
    get_outputs_by_vkh
}


// ////////////////////////////////////////////////////////////////////////////////
// Types:
// ////////////////////////////////////////////////////////////////////////////////

pub type Datum {
    oracle: VerificationKeyHash,
    wager: Lovelace,
    player_1: VerificationKeyHash,
    player_2: VerificationKeyHash,
    deadline: POSIXTime,
    is_joined: Bool,
}

pub type Redeemer {
    Join { wager: Lovelace }
    Win { winner: VerificationKeyHash }
    Timeout
}


// ////////////////////////////////////////////////////////////////////////////////
// Validator:
// ////////////////////////////////////////////////////////////////////////////////

validator bet {
    spend(
        datum: Option<Datum>,
        redeemer: Redeemer,
        _own_ref: OutputReference,
        ctx: ScriptContext,
    ) {
        // Extract previous state datum
        expect Some(Datum { oracle, wager: prev_wager, player_1: prev_p1, player_2: prev_p2, deadline, is_joined }) = datum

        // Alias the inner transaction
        let tx = ctx.transaction

        // Compute transaction earliest valid time
        let tx_earliest_time =
            when tx.validity_range.lower_bound.bound_type is {
                Finite(x) -> x
                _         -> 0
            }

        // Contract UTXO and balances
        let own_input = get_own_input(ctx)
        let contract_address = own_input.output.address

        let contract_outputs = get_outputs_by_address(tx.outputs, contract_address)
        let contract_inputs  = get_inputs_by_address (tx.inputs,  contract_address)

        let contract_inputs_balance  = get_ada_from_inputs(contract_inputs)
        let contract_outputs_balance = get_ada_from_outputs(contract_outputs)

        when redeemer is {
            Join { wager } -> {
                // Contract must have only one output
                expect True = list.length(contract_outputs) == 1
                expect Some(contract_output) = list.at(contract_outputs, 0)

                // Getting the output's datum
                expect InlineDatum(untyped_datum) = contract_output.datum
                expect contract_output_datum: Datum = untyped_datum

                // Get the two transaction's signers
                expect Some(player_1) = list.at(tx.extra_signatories, 0)
                expect Some(player_2) = list.at(tx.extra_signatories, 1)

                // Players balances
                let player_1_inputs_balance = get_ada_from_inputs(get_inputs_by_vkh(tx.inputs,  player_1))
                let player_1_outputs_balance = get_ada_from_outputs(get_outputs_by_vkh(tx.outputs, player_1))

                let player_2_inputs_balance  = get_ada_from_inputs(get_inputs_by_vkh(tx.inputs,  player_2))
                let player_2_outputs_balance = get_ada_from_outputs(get_outputs_by_vkh(tx.outputs, player_2))

                and {
                    // Players are joining the contract before the deadline
                    deadline > tx_earliest_time,

                    // Correct total wager amount
                    contract_outputs_balance - contract_inputs_balance == wager * 2,

                    // The wager value must be inserted in the datum
                    contract_output_datum.wager == wager,

                    // Players are joining an empty contract and updating state
                    !is_joined && contract_output_datum.is_joined,

                    // A player cannot be the oracle
                    oracle != player_1 && oracle != player_2,

                    // Players are paying wager and fees correctly
                    trace @"join_player1": player_1
                    trace @"join_player1_bal": player_1_inputs_balance - wager - tx.fee
                    trace @"join_player2": player_2
                    trace @"join_player2_bal": player_2_inputs_balance - wager
                    player_1_outputs_balance == player_1_inputs_balance - wager - tx.fee,
                    player_2_outputs_balance == player_2_inputs_balance - wager,

                    // New datum updates player fields correctly
                    contract_output_datum.player_1 == player_1,
                    contract_output_datum.player_2 == player_2,

                    // Datum retains deadline and oracle
                    contract_output_datum.deadline == deadline,
                    contract_output_datum.oracle   == oracle
                }
            }

            Win { winner } -> {
                expect Some(tx_signer) = list.at(tx.extra_signatories, 0)

                and {
                    // Only the oracle can perform this action
                    tx_signer == oracle,

                    // Players must have joined the contract
                    is_joined,

                    // Oracle acts before the deadline
                    deadline > tx_earliest_time,

                    // Oracle chooses a valid winner
                    or {
                        winner == prev_p1,
                        winner == prev_p2
                    },

                    // Winner receives the pot
                    trace @"winner": winner
                    get_ada_from_outputs(get_outputs_by_vkh(tx.outputs, winner)) == prev_wager * 2
                }
            }

            Timeout -> {
                // Get the two transaction's signers
                expect Some(player_1) = list.at(tx.extra_signatories, 0)
                expect Some(player_2) = list.at(tx.extra_signatories, 1)

                // Players balances
                let player_1_inputs_balance  = get_ada_from_inputs(get_inputs_by_vkh(tx.inputs,  player_1))
                let player_1_outputs_balance = get_ada_from_outputs(get_outputs_by_vkh(tx.outputs, player_1))

                let player_2_inputs_balance  = get_ada_from_inputs(get_inputs_by_vkh(tx.inputs,  player_2))
                let player_2_outputs_balance = get_ada_from_outputs(get_outputs_by_vkh(tx.outputs, player_2))

                and {
                    // Players must have joined previously
                    is_joined,

                    // Correct signers
                    player_1 == prev_p1,
                    player_2 == prev_p2,

                    // Timeout after the deadline
                    deadline < tx_earliest_time,

                    // Players receive refund minus fees
                    trace @"timeout_player1_bal": player_1_inputs_balance + prev_wager - tx.fee
                    trace @"timeout_player2_bal": player_2_inputs_balance + prev_wager
                    player_1_outputs_balance == player_1_inputs_balance + prev_wager - tx.fee,
                    player_2_outputs_balance == player_2_inputs_balance + prev_wager
                }
            }
        }
    }
}

// ////////////////////////////////////////////////////////////////////////////////
// Test:
// ////////////////////////////////////////////////////////////////////////////////

test bet_join() {
    // 1) Keys and wager
    let oracle   : VerificationKeyHash = #"01"
    let player_1 : VerificationKeyHash = #"02"
    let player_2 : VerificationKeyHash = #"03"
    let wager    : Lovelace           = 5
    let deadline : POSIXTime          = 1_000_000

    // 2) Initial datum: not yet joined
    let initial_datum : Datum =
      Datum {
        oracle:    oracle,
        wager:     wager,
        player_1:  player_1,
        player_2:  player_2,
        deadline:  deadline,
        is_joined: False
      }

    // 3) Join redeemer
    let redeemer : Redeemer = Join { wager: wager }

    // 4) The UTXO we’re “spending”
    let placeholder_utxo : OutputReference =
      OutputReference { transaction_id: "", output_index: 0 }

    // 5) Contract address
    let contract_address : Address =
      Address {
        payment_credential: VerificationKey(oracle),
        stake_credential:   None
      }

    // 6) Contract input UTXO
    let contract_input : Input =
      Input {
        output_reference: placeholder_utxo,
        output: Output {
          address:          contract_address,
          value:            from_lovelace(0),
          datum:            InlineDatum(initial_datum),
          reference_script: None
        }
      }

    // 7) Player inputs
    let p1_utxo : OutputReference =
      OutputReference { transaction_id: "p1", output_index: 0 }
    let p1_input : Input =
      Input {
        output_reference: p1_utxo,
        output: Output {
          address: Address {
                     payment_credential: VerificationKey(player_1),
                     stake_credential:   None
                   },
          value:            from_lovelace(wager),
          datum:            NoDatum,
          reference_script: None
        }
      }

    let p2_utxo : OutputReference =
      OutputReference { transaction_id: "p2", output_index: 0 }
    let p2_input : Input =
      Input {
        output_reference: p2_utxo,
        output: Output {
          address: Address {
                     payment_credential: VerificationKey(player_2),
                     stake_credential:   None
                   },
          value:            from_lovelace(wager),
          datum:            NoDatum,
          reference_script: None
        }
      }

    // 8) Contract output (joined state) – now with reference_script: None
    let joined_datum : Datum =
      Datum { ..initial_datum, is_joined: True }
    let contract_output : Output =
      Output {
        address:          contract_address,
        value:            from_lovelace(wager * 2),
        datum:            InlineDatum(joined_datum),
        reference_script: None
      }

    // 9) Build the transaction (using record‐update to inherit all other fields)
    let tx : Transaction =
      Transaction {
        ..transaction.placeholder,
        inputs:            [ contract_input, p1_input, p2_input ],
        outputs:           [ contract_output ],
        extra_signatories: [ player_1, player_2 ]
      }

    // 10) Wrap in ScriptContext
    let ctx : ScriptContext =
      ScriptContext {
        transaction: tx,
        redeemer: redeemer,
        info: Spending { output: placeholder_utxo, datum: None }
      }

    // Finally invoke your validator
    bet.spend(
      Some(initial_datum),
      redeemer,
      placeholder_utxo,
      ctx
    )
}
