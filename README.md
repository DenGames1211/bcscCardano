# bcscCardano

#### dApp Web Bet & Auction
Per poter deployare una transazione sulla testnet, come prima cosa generiamo i file plutus associati ai singoli validator:
aiken blueprint convert > bet.plutus.json
aiken blueprint convert > auction.plutus.json




### TraceTool

First things first, starting from a .aiken validator we need to generate its associated .plutus file, so that fees may be estimated:
aiken blueprint convert > bet.plutus.json


Then, what the trace-tool does is generate a payment verification and signing key:
cardano-cli address key-gen \
  --verification-key-file payment.vkey \
  --signing-key-file     payment.skey


Then, we need to get an appropriate payment address as necessary parameter of build-transaction:
cardano-cli address build \
  --payment-verification-key-file keys/payment.vkey \
  --out-file keys/payment.addr \
  --mainnet

Finally we can list UTXOs by:
cardano-cli conway query utxo \
  --address $(cat keys/payment.addr) \
  --mainnet


In the tool, to then build a raw tx:
cardano-cli conway transaction build-raw \
  --fee 0 \
  --tx-in 0000000000000000000000000000000000000000000000000000000000000000#0 \
  --tx-out "addr_test1vr8rgrxvlgg0wh3d05yhg53lw3n80fj7m8p0j2mj6r0hkyc4x98sf+0" \
  --tx-out "addr_test1vr8rgrxvlgg0wh3d05yhg53lw3n80fj7m8p0j2mj6r0hkyc4x98sf+0" \
  --tx-in-script-file raw_validators/bet.plutus \
  --tx-in-datum-value '{"oracle":"01","wager":5,"player_1":"02","player_2":"03","deadline":1000000,"is_joined":0}' \
  --tx-in-redeemer-value '{"Join":{"wager":5}}' \
  --tx-in-execution-units "(0,0)" \
  --out-file dummy.tx


To get the protocol.json, we need to start a cardano node, with a command such as:
 cardano-node run \
   --topology topology.json \
   --database-path db \
   --socket-path db/node.socket \
   --host-addr 0.0.0.0 \
   --port 3001 \
   --config config.json

We can also look where we are with our sync to mainnet in respect to our tip:
export CARDANO_NODE_SOCKET_PATH=~/cardano-node/mainnet-files/db/node.socket
cardano-cli query tip --mainnet

Now it's possible to query the protocol parameters:
cardano-cli query protocol-parameters \
  --mainnet \
  --socket-path   $CARDANO_NODE_SOCKET_PATH \
  --out-file      protocol.json

Finally, we can estimate fees by:
cardano-cli conway transaction calculate-min-fee \
  --tx-body-file dummy.tx \
  --tx-in-count 1 \
  --tx-out-count 2 \
  --witness-count 2 \
  --protocol-params-file protocol.json \
  --mainnet
