// /////////////////////////////////////////////////////////////////////////////////////////////////////////
// Imports
// /////////////////////////////////////////////////////////////////////////////////////////////////////////

use aiken/collection/list
use aiken/crypto.{Blake2b_224, Hash}
use aiken/interval.{Finite}
//use cardano/address.{Address, Credential, VerificationKeyCredential}
//use cardano/crypto.{VerificationKey}
use cardano/address.{Address, VerificationKey}
use cardano/assets
use cardano/script_context.{ScriptContext, Spending}
use cardano/transaction.{
  Input, Output, OutputReference, Transaction, ValidityRange,
}

// use aiken/cbor // diagnostic

// /////////////////////////////////////////////////////////////////////////////////////////////////////////

// /////////////////////////////////////////////////////////////////////////////////////////////////////////
// Types definition
// /////////////////////////////////////////////////////////////////////////////////////////////////////////

pub type VerificationKeyHash =
  Hash<Blake2b_224, ByteArray>

pub type POSIXTime =
  Int

pub type Lovelace =
  Int

// /////////////////////////////////////////////////////////////////////////////////////////////////////////

// /////////////////////////////////////////////////////////////////////////////////////////////////////////
// Public functions
// /////////////////////////////////////////////////////////////////////////////////////////////////////////

/// ***
/// @funct get_own_input
/// @brief - Returns the specific input being processed by the current contract's execution instance
/// @param ctx
/// @return input - The UTXO associated with the contract's execution
/// *** 
pub fn get_own_input(ctx: ScriptContext) -> Input {
  // Extract the ScriptInfo from the context
  expect Spending { output: output_ref, .. } = ctx.info

  // Now find the matching input in the transaction inputs
  expect Some(input) =
    list.find(
      ctx.transaction.inputs,
      fn(input) { input.output_reference == output_ref },
    )

  input
}

/// ***
/// @funct must_be_signed_by
/// @brief Checks if the provided Transaction is signed by the provided VerificationKeyHash
/// @param transaction
/// @param vk
/// @return Bool - True if the transaction contains vk in the signatories, False otherwise 
/// *** 
pub fn must_be_signed_by(transaction: Transaction, vk: VerificationKeyHash) {
  list.has(transaction.extra_signatories, vk)
}

/// ***
/// @funct get_ada_from_outputs
/// @brief - Sums up all the lovelace values in the outputs list 
/// @param outputs
/// @return balance - The outputs' balance in lovelace
/// *** 
pub fn get_ada_from_outputs(outputs: List<Output>) -> Int {
  list.reduce(
    outputs,
    0,
    fn(acc, output) { acc + assets.lovelace_of(output.value) },
  )
}

/// ***
/// @funct get_ada_from_inputs
/// @brief - Sums up all the lovelace values in the inputs list 
/// @param inputs
/// @return balance - The inputs' balance in lovelace
/// *** 
pub fn get_ada_from_inputs(inputs: List<Input>) -> Int {
  list.reduce(
    inputs,
    0,
    fn(acc, input) { acc + assets.lovelace_of(input.output.value) },
  )
}

/// ***
/// @funct get_outputs_by_vkh
/// @brief - Keeps in the outputs list only the ones having vkh as their address
/// @param outputs
/// @param vkh
/// @return outputs - The Output list containing UTXOs own by vkh  
/// ***
pub fn get_outputs_by_vkh(
  outputs: List<Output>,
  vkc: VerificationKeyHash,
) -> List<Output> {
  list.filter(
    outputs,
    fn(output) {
      when output.address.payment_credential is {
        // Match on the correct constructor
        VerificationKey(addr_vkh) -> addr_vkh == vkc
        _ -> False
      }
    },
  )
}

/// ***
/// @funct get_outputs_by_address
/// @brief - Keeps in the outputs list only the ones having addr as their address
/// @param outputs
/// @param addr
/// @return outputs - The Output list containing outputs own by addr
/// *** 
pub fn get_outputs_by_address(
  outputs: List<Output>,
  addr: Address,
) -> List<Output> {
  list.filter(outputs, fn(output) { output.address == addr })
}

/// ***
/// @funct get_inputs_by_vkh
/// @brief - Keeps in the inputs list only the ones having vkh as their address
/// @param inputs
/// @param vkh
/// @return inputs - The Input list containing UTXOs own by vkh  
/// ***
pub fn get_inputs_by_vkh(
  inputs: List<Input>,
  vkc: VerificationKeyHash,
) -> List<Input> {
  list.filter(
    inputs,
    fn(input) {
      when input.output.address.payment_credential is {
        // Match on the correct constructor
        VerificationKey(addr_vkh) -> addr_vkh == vkc
        _ -> False
      }
    },
  )
}

/// ***
/// @funct has_transaction_n_output_addresses
/// @brief - Checks if there are exactly n addresses in the transaction's outputs list
/// @param transaction
/// @param n - The number of addresses the transaction should have in its outputs
/// @return Bool - True if the transaction's outputs' addresses list contains exactly n unique elements, False otherwise
/// *** 
pub fn has_transaction_n_output_addresses(
  transaction: Transaction,
  n: Int,
) -> Bool {
  let number_of_output_addresses =
    list.foldl(transaction.outputs, [], fn(x, xs) { list.push(xs, x.address) })
      // list of addresses
      |> list.unique
      |> list.length

  number_of_output_addresses == n
}

/// ***
/// @funct must_start_before_timeout
/// @brief - Checks if the tx's validity earliest time has not passed the timeout
/// @param range
/// @param timeout
/// @return Bool
/// ***
pub fn must_start_before_timeout(range: ValidityRange, timeout: POSIXTime) {
  when range.lower_bound.bound_type is {
    Finite(tx_earliest_time) -> timeout >= tx_earliest_time
    _ -> False
  }
}
// /////////////////////////////////////////////////////////////////////////////////////////////////////////
