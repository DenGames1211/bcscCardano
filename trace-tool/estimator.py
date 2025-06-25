import pandas as pd
import json
import subprocess

PROTOCOL_PARAMS = "./protocol.json"

def read_trace(csv_path):
    df = pd.read_csv(csv_path)
    traces = []
    for _, row in df.iterrows():
        datum = json.loads(row['Datum'])
        redeemer = json.loads(row['Redeemer'])
        traces.append({
            'ID': row['ID'],
            'Program': row['Program'],
            'Function': row['Function'],
            'N_accounts': row['N accounts'],
            'N_signers': row['N signers'],
            'datum': datum,
            'redeemer': redeemer
        })
    return traces

def build_raw_tx(trace, script_file, raw_file):
    print(script_file)
    command = [
        "cardano-cli", "conway", "transaction", "build-raw",
        "--fee", "0",
        "--tx-in", "0000000000000000000000000000000000000000000000000000000000000000#0",
        "--tx-out", "addr_test1vr8rgrxvlgg0wh3d05yhg53lw3n80fj7m8p0j2mj6r0hkyc4x98sf+0",
        "--tx-out", "addr_test1vr8rgrxvlgg0wh3d05yhg53lw3n80fj7m8p0j2mj6r0hkyc4x98sf+0",
        "--tx-in-script-file", script_file,
        "--tx-in-datum-value", json.dumps(trace['datum']),
        "--tx-in-redeemer-value", json.dumps(trace['redeemer']),
        "--tx-in-execution-units", "(0,0)",
        "--out-file", raw_file 
    ]
    result = subprocess.run(command, check=True)
    if result.returncode != 0:
        raise RuntimeError(f"cardano-cli failed:\n{result.stderr}")


def calculate_fee_and_size(tx_raw_file, trace):
    result_fee = subprocess.run([
        "cardano-cli", "conway", "transaction", "calculate-min-fee",
        "--tx-body-file", tx_raw_file,
        "--tx-in-count", str(trace['N_accounts']),
        "--tx-out-count", "1",
        "--witness-count", str(trace['N_signers']),
        "--protocol-params-file", PROTOCOL_PARAMS,
        "--mainnet"
    ], capture_output=True, text=True)

    fee = int(result_fee.stdout.split()[0])

    result_size = subprocess.run([
        "cardano-cli", "transaction", "view",
        "--tx-body-file", tx_raw_file
    ], capture_output=True, text=True)

    tx_info = json.loads(result_size.stdout)
    size = tx_info["txSize"]

    return fee, size

def export_results(results, output_csv):
    df = pd.DataFrame(results)
    df.to_csv(output_csv, index=False)

def main(input_csv, output_csv, script_path):
    raw_path = "./dummy.tx"
    traces = read_trace(input_csv)
    results = []

    for trace in traces:
        build_raw_tx(trace, script_path, raw_path)
        fee, size = calculate_fee_and_size(script_path, trace)

        results.append({
            'ID': trace['ID'],
            'Size (bytes)': size,
            'Fees': fee
        })

    pd.DataFrame(results).to_csv(output_csv, index=False)

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 4:
        print("Usage: python estimator.py input.csv output.csv raw.plutus")
    else:
        _, in_csv, out_csv, raw_path = sys.argv
        main(in_csv, out_csv, raw_path)