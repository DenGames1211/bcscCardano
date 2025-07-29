// Suggested stdlib version: 1.6.0 (https://github.com/aiken-lang/stdlib/releases/tag/1.6.0)

// ////////////////////////////////////////////////////////////////////////////////
// Imports:
// ////////////////////////////////////////////////////////////////////////////////

use aiken/collection/list
use aiken/crypto.{Sha3_256, Hash, sha3_256}
use cardano/transaction.{Transaction, OutputReference, ValidityRange, Input}
use cardano/script_context.{ScriptContext}
use aiken/interval.{Finite}
use cardano/assets.{lovelace_of}

use utils/htlc_utils.{
    VerificationKeyHash, 
    POSIXTime,
    get_own_input,
    get_ada_from_inputs,
    get_ada_from_outputs,
    get_inputs_by_vkh,
    get_outputs_by_vkh
}

// ////////////////////////////////////////////////////////////////////////////////


// ////////////////////////////////////////////////////////////////////////////////
// Types: 
// ////////////////////////////////////////////////////////////////////////////////

type SecretHash = Hash<Sha3_256, ByteArray>

pub type Datum {
    committer: VerificationKeyHash,
    receiver: VerificationKeyHash,
    secret_hash: SecretHash,
    timeout: POSIXTime // we cannot access blocks and epochs on chain
}

pub type Redeemer {
    Reveal { secret: ByteArray }
    Timeout
}

// ////////////////////////////////////////////////////////////////////////////////


// ////////////////////////////////////////////////////////////////////////////////
// Validator:
// ////////////////////////////////////////////////////////////////////////////////

fn must_be_signed_by(transaction: Transaction, vk: VerificationKeyHash) {
    list.has(transaction.extra_signatories, vk)
} 

fn must_start_after(range: ValidityRange, timeout: POSIXTime) {
  when range.lower_bound.bound_type is {
    Finite(tx_earliest_time) -> timeout <= tx_earliest_time
    _ -> False
  }
}

validator htlc {
    spend(
        m_datum: Option<Datum>, 
        redeemer: Redeemer, 
        _own_ref: OutputReference,
        ctx: ScriptContext
    ) {
        let tx = ctx.transaction

        expect Some(datum) = m_datum
        expect Some(tx_signer) = list.at(tx.extra_signatories, 0)
        
        let tx_signer_inputs = get_inputs_by_vkh(tx.inputs, tx_signer)
        let tx_signer_outputs = get_outputs_by_vkh(tx.outputs, tx_signer)

        let tx_signer_inputs_ada = get_ada_from_inputs(tx_signer_inputs)
        let tx_signers_outputs_ada = get_ada_from_outputs(tx_signer_outputs)

        let own_input = get_own_input(ctx)
        let tx_value = lovelace_of(own_input.output.value)
        expect True = tx_signers_outputs_ada == tx_signer_inputs_ada + tx_value - tx.fee

        when redeemer is {
            Reveal { secret } -> {
                and {
                    must_be_signed_by(tx, datum.committer),
                    sha3_256(secret) == datum.secret_hash,
                    !must_start_after(tx.validity_range, datum.timeout)
                }
                
            }
            Timeout -> {
                and {
                    must_be_signed_by(tx, datum.receiver),
                    must_start_after(tx.validity_range, datum.timeout)
                }
            }
        }     
    }
}

// ////////////////////////////////////////////////////////////////////////////////


// ////////////////////////////////////////////////////////////////////////////////
// Tests:
// ////////////////////////////////////////////////////////////////////////////////

test sha3_256_is_equal_1(){
    let preimage: ByteArray = "test"
    let precomputed_hash: SecretHash = #"36f028580bb02cc8272a9a020f4200e346e276ae664e45ee80745574e2f5ab80" // https://aiken-lang.org/language-tour/primitive-types#3---as-a-hex-encoded-byte-string

    sha3_256(preimage) == precomputed_hash
}

// ////////////////////////////////////////////////////////////////////////////////