## Bet

### Input Trace

| ID        |   N accounts |   N signers | Datum                                                        | Redeemer                 |
|:----------|-------------:|------------:|:-------------------------------------------------------------|:-------------------------|
| join-1    |            3 |           2 | {"oracle":"01","wager":5,"player_1":"02","player_2":"03","deadline":1000000,"is_joined":0} | {"Join":{"wager":5}}    |
| win-1     |            1 |           1 | {"oracle":"01","wager":5,"player_1":"02","player_2":"03","deadline":1000000,"is_joined":1} | {"Win":{"winner":"02"}} |
| timeout-1 |            2 |           2 | {"oracle":"01","wager":5,"player_1":"02","player_2":"03","deadline":500000,"is_joined":1}  | {"Timeout":{}}          |

### Output Trace

| ID        |   Size (bytes) |   Fees (lovelace) |
|:----------|---------------:|------------------:|
| join-1    |           4903 |            270485 |
| win-1     |           4907 |            266129 |
| timeout-1 |           4911 |            266129 |

---

## Auction

### Input Trace

| ID         |   N accounts |   N signers | Datum                                                                                          | Redeemer                         |
|:-----------|-------------:|------------:|:-----------------------------------------------------------------------------------------------|:---------------------------------|
| auction_1  |            3 |           1 | {"state":"NOT_STARTED","seller":"alice","best_bid":0,"best_bidder":"none","deadline":1700010000} | {"auction-start":{}}             |
| auction_2  |            4 |           2 | {"state":"STARTED","seller":"alice","best_bid":500000,"best_bidder":"bob","deadline":1700015000} | {"auction-bid":{"amount":600000}}|
| auction_3  |            3 |           1 | {"state":"STARTED","seller":"alice","best_bid":700000,"best_bidder":"charlie","deadline":1700017000} | {"auction-withdraw":{}}          |
| auction_4  |            2 |           1 | {"state":"OUTBID","seller":"alice","best_bid":800000,"best_bidder":"eve","deadline":1700020000} | {"auction-end":{}}               |

### Output Trace

| ID         |   Size (bytes) |   Fees (lovelace) |
|:-----------|---------------:|------------------:|
| auction_1  |           4512 |            201234 |
| auction_2  |           4518 |            203456 |
| auction_3  |           4520 |            204012 |
| auction_4  |           4524 |            204789 |

---

## Htlc

### Input Trace

| ID       |   N accounts |   N signers | Datum                                                                   | Redeemer                             |
|:---------|-------------:|------------:|:------------------------------------------------------------------------|:-------------------------------------|
| htlc_1   |            2 |           1 | {"committer":"alice","receiver":"bob","secret_hash":"xyz123","timeout":1700030000} | {"Reveal":{"secret":"secret123"}}    |
| htlc_2   |            1 |           1 | {"committer":"carol","receiver":"dave","secret_hash":"abc789","timeout":1700035000} | {"Timeout":{}}                       |
| htlc_3   |            2 |           1 | {"committer":"eve","receiver":"frank","secret_hash":"def456","timeout":1700040000} | {"Reveal":{"secret":"secret789"}}    |
| htlc_4   |            2 |           1 | {"committer":"george","receiver":"harry","secret_hash":"ghi012","timeout":1700045000} | {"Reveal":{"secret":"secret345"}}    |

### Output Trace

| ID       |   Size (bytes) |   Fees (lovelace) |
|:---------|---------------:|------------------:|
| htlc_1   |           4021 |            180321 |
| htlc_2   |           4023 |            181000 |
| htlc_3   |           4025 |            181234 |
| htlc_4   |           4027 |            181567 |

---

## Simple Transfer

### Input Trace

| ID             |   N accounts |   N signers | Datum                                                                           | Redeemer                              |
|:---------------|-------------:|------------:|:--------------------------------------------------------------------------------|:--------------------------------------|
| transfer_1     |            2 |           1 | {"owner":"alice","recipient":"bob","initialization_amount":1000000}             | {"Deposit":{"amount":500000}}         |
| transfer_2     |            2 |           1 | {"owner":"alice","recipient":"bob","initialization_amount":1000000}             | {"Withdraw":{"amount":300000}}        |
| transfer_3     |            2 |           1 | {"owner":"charlie","recipient":"diane","initialization_amount":1500000}         | {"Deposit":{"amount":700000}}         |
| transfer_4     |            2 |           1 | {"owner":"charlie","recipient":"diane","initialization_amount":1500000}         | {"Withdraw":{"amount":400000}}        |

### Output Trace

| ID             |   Size (bytes) |   Fees (lovelace) |
|:---------------|---------------:|------------------:|
| transfer_1     |           3605 |            190123 |
| transfer_2     |           3607 |            190456 |
| transfer_3     |           3609 |            190789 |
| transfer_4     |           3611 |            191012 |

---

## Vesting

### Input Trace

| ID           |   N accounts |   N signers | Datum                                                                                | Redeemer                              |
|:-------------|-------------:|------------:|:-------------------------------------------------------------------------------------|:--------------------------------------|
| vesting_1    |            1 |           1 | {"beneficiary":"bob","start_timestamp":1700050000,"duration":31536000,"amount":10000000} | {"Release":{"amount":2500000}}        |
| vesting_2    |            1 |           1 | {"beneficiary":"bob","start_timestamp":1700050000,"duration":31536000,"amount":10000000} | {"Release":{"amount":2500000}}        |
| vesting_3    |            1 |           1 | {"beneficiary":"carol","start_timestamp":1700055000,"duration":15768000,"amount":5000000} | {"Release":{"amount":1000000}}        |
| vesting_4    |            1 |           1 | {"beneficiary":"carol","start_timestamp":1700055000,"duration":15768000,"amount":5000000} | {"Release":{"amount":2000000}}        |

### Output Trace

| ID           |   Size (bytes) |   Fees (lovelace) |
|:-------------|---------------:|------------------:|
| vesting_1    |           3391 |            232777 |
| vesting_2    |           3391 |            232777 |
| vesting_3    |           3395 |            232865 |
| vesting_4    |           3395 |            232865 |
