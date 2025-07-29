// Suggested stdlib version: 2.2.0 (https://github.com/aiken-lang/stdlib/releases/tag/2.2.0)

// /////////////////////////////////////////////////////////////////////////////////////////////////////////
// Imports
// /////////////////////////////////////////////////////////////////////////////////////////////////////////

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Address, VerificationKey}
use cardano/assets
use cardano/script_context.{ScriptContext, Spending}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
}
use utils/sp_utils.{
  Lovelace, get_ada_from_inputs, get_ada_from_outputs, get_inputs_by_address,
  get_inputs_by_vkh, get_outputs_by_address, get_outputs_by_vkh, get_own_input,
  must_be_signed_by,
}

// use aiken/cbor // diagnostic

// /////////////////////////////////////////////////////////////////////////////////////////////////////////

// /////////////////////////////////////////////////////////////////////////////////////////////////////////
// Types definition
// /////////////////////////////////////////////////////////////////////////////////////////////////////////

/// Partecipants:
/// - owner      (O)
/// - recipient  (R)
/// Description:
/// The owner deposits ADA in the contract and the specified recipient can withdraw any arbitrary fractions 
/// of the contract's balance. In addition to that, the contract checks if the current transaction (in its
/// outputs) preserves the contract when the correct ADA amount is returned to it.
pub type Datum {
  owner: VerificationKeyHash,
  recipient: VerificationKeyHash,
  initialization_amount: Lovelace,
}

// (offset) this amount can never be moved from the contract

pub type Redeemer {
  Deposit { amount: Lovelace }
  Withdraw { amount: Lovelace }
}

// /////////////////////////////////////////////////////////////////////////////////////////////////////////

// /////////////////////////////////////////////////////////////////////////////////////////////////////////
// Auxiliary functions and validator
// /////////////////////////////////////////////////////////////////////////////////////////////////////////

validator simple_transfer {
  /// ***
  /// @valid simple_transfer
  /// @param datum
  /// @param redeemer
  /// @param ctx - The context 'object' in which the transaction is executed
  /// @return Bool
  /// ***
  spend(
    m_datum: Option<Datum>,
    redeemer: Redeemer,
    _own_ref: OutputReference,
    ctx: ScriptContext,
  ) {
    expect Some(datum) = m_datum

    let tx = ctx.transaction
    let own_input = get_own_input(ctx)
    let contract_address = own_input.output.address
    let offset = datum.initialization_amount

    let recipient_inputs = get_inputs_by_vkh(tx.inputs, datum.recipient)
    let recipient_outputs = get_outputs_by_vkh(tx.outputs, datum.recipient)
    let owner_outputs = get_outputs_by_vkh(tx.outputs, datum.owner)

    let contract_inputs = get_inputs_by_address(tx.inputs, contract_address)
    let contract_outputs = get_outputs_by_address(tx.outputs, contract_address)
    let contract_balance = assets.lovelace_of(own_input.output.value)

    trace ("contract_balance", contract_balance)
    trace ("ada_from_contract_inputs", get_ada_from_inputs(contract_inputs))
    trace ("contract_outputs_length", list.length(contract_outputs))
    trace (
      "all_contract_outputs_have_datum",
      list.all(contract_outputs, fn(o) { o.datum == InlineDatum(m_datum) }),
    )
    trace ("owner_outputs_length", list.length(owner_outputs))
    trace ("recipient_outputs_length", list.length(recipient_outputs))
    expect and {
        contract_balance == get_ada_from_inputs(contract_inputs),
        !list.is_empty(contract_outputs),
        list.all(
          contract_outputs,
          fn(output) { output.datum == InlineDatum(m_datum) },
        ),
      }

    when redeemer is {
      Deposit { amount } -> and {
          must_be_signed_by(tx, datum.owner),
          !list.is_empty(owner_outputs),
          get_ada_from_outputs(contract_outputs) == contract_balance + amount,
        }

      Withdraw { amount } -> and {
          must_be_signed_by(tx, datum.recipient),
          contract_balance - offset >= amount,
          !list.is_empty(recipient_outputs),
          get_ada_from_outputs(contract_outputs) == contract_balance - amount,
          get_ada_from_outputs(recipient_outputs) == get_ada_from_inputs(
            recipient_inputs,
          ) + amount - tx.fee,
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
test sp_deposit() {
  let owner_vkh = #"123456"
  let recipient_vkh = #"abcdef"
  let initial_amount = 1_000_000
  let deposit_amount = 500_000
  let script_hash = #"01"

  let datum = Datum {
    owner: owner_vkh,
    recipient: recipient_vkh,
    initialization_amount: initial_amount
  }

  let contract_address = Address {
    payment_credential: VerificationKey(script_hash),
    stake_credential: None
  }

  let contract_output = Output {
    address: contract_address,
    value: assets.from_lovelace(initial_amount + deposit_amount),
    datum: InlineDatum(Some(datum)),
    reference_script: None
  }

  let contract_input = Output {
    address: contract_address,
    value: assets.from_lovelace(initial_amount),
    datum: InlineDatum(Some(datum)),
    reference_script: None
  }

  let contract_utxo = OutputReference {
    transaction_id: "abcd",
    output_index: 0
  }

  let own_input = Input {
    output_reference: contract_utxo,
    output: contract_input
  }

  let owner_output = Output {
    address: Address {
      payment_credential: VerificationKey(owner_vkh),
      stake_credential: None
    },
    value: assets.from_lovelace(1_000_000),
    datum: NoDatum,
    reference_script: None
  }

  let tx = Transaction {
    ..transaction.placeholder,
    inputs: [own_input],
    outputs: [contract_output, owner_output],
    extra_signatories: [owner_vkh],
  }

  let datum_data: Data = datum
  let ctx: ScriptContext =
    ScriptContext {
      transaction: tx,
      redeemer: Deposit { amount: deposit_amount },
      info: Spending { output: own_input.output_reference, datum: Some(datum_data) }
  }

  simple_transfer.spend(
    Some(datum),
    Deposit { amount: deposit_amount },
    own_input.output_reference,
    ctx
  )
}
