// Suggested stdlib version: 1.7.0 (https://github.com/aiken-lang/stdlib/releases/tag/1.7.0)

// ////////////////////////////////////////////////////////////////////////////////
// Imports:
// ////////////////////////////////////////////////////////////////////////////////

use aiken/collection/list
use cardano/transaction.{InlineDatum, OutputReference}
use cardano/script_context.{ScriptContext}
use cardano/assets.{lovelace_of}
use aiken/interval.{Finite}

use utils/vesting_utils.{
	POSIXTime, 
	VerificationKeyHash, 
	Lovelace,
	get_own_input,
	must_be_signed_by,
	get_ada_from_outputs,
	get_ada_from_inputs,
	get_outputs_by_vkh,
	get_outputs_by_address,
	get_inputs_by_vkh
}

// use aiken/cbor // diagnostic

// ////////////////////////////////////////////////////////////////////////////////


// ////////////////////////////////////////////////////////////////////////////////
// Types: 
// ////////////////////////////////////////////////////////////////////////////////

pub type Datum {
	beneficiary: VerificationKeyHash,
	start_timestamp: POSIXTime,
	duration: POSIXTime,
	amount: Lovelace,
}

// ////////////////////////////////////////////////////////////////////////////////

pub type Redeemer {
	Release { amount: Lovelace }
}


// ////////////////////////////////////////////////////////////////////////////////
// Validator:
// ////////////////////////////////////////////////////////////////////////////////

validator vesting {
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

		let contract_outputs =
			get_outputs_by_address(tx.outputs, contract_address)

		let contract_amount = lovelace_of(own_input.output.value)

		let beneficiary_inputs = 
			get_inputs_by_vkh(tx.inputs, datum.beneficiary)

		let beneficiary_outputs = 
			get_outputs_by_vkh(tx.outputs, datum.beneficiary)

		let tx_earliest_time =
			when tx.validity_range.lower_bound.bound_type is {
				Finite(x) -> x
				_ -> 0
			}

		// We compute the already relased amount by subtracting the own input's balance to the total amount
		let released = datum.amount - contract_amount

		let linear_vesting = fn (total_allocation: Lovelace, timestamp: POSIXTime) {
			let min_vesting_time = datum.start_timestamp
			let max_vesting_time = datum.start_timestamp + datum.duration

			if timestamp < min_vesting_time {
				0
			} else if timestamp > max_vesting_time {
				total_allocation
			} else {
				total_allocation * (timestamp - datum.start_timestamp) / datum.duration
			}
		}
		
		let Release { amount } = redeemer // https://aiken-lang.org/language-tour/custom-types#destructuring
		let release_amount = linear_vesting(datum.amount, tx_earliest_time) - released // This is the amount beneficiary should take

		expect True = and {
			must_be_signed_by(tx, datum.beneficiary)?,

			(amount == release_amount)?, 
			
			// Beneficiary is receiving the correct amount (this is comprehensive of tx's fee):
			(get_ada_from_outputs(beneficiary_outputs) == amount + get_ada_from_inputs(beneficiary_inputs) - tx.fee)?,
		}

		if(amount == contract_amount) {
			// If the beneficiary is reclaiming the full amount, there's not need to return something back to the contract and check its new datum
			True
		}
		else {
			// We expect a contract output (to receive the correct amount difference back when collecting from this contract)
			expect (list.length(contract_outputs) == 1)?
			expect Some(contract_output) = list.at(contract_outputs, 0)

			// Checking the new datum:
			expect InlineDatum(untyped_datum) = contract_output.datum
			expect contract_output_datum: Datum = untyped_datum

			// New output must not change datum
			(contract_output_datum == datum)?
		}
	}
	// reject any other script-purpose
    else(_ctx: ScriptContext) {
        False
    }		
}

// ////////////////////////////////////////////////////////////////////////////////
