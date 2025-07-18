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

| ID         | N accounts | N signers | Datum                                                                                                  | Redeemer                          |
| :--------- | ---------: | --------: | :----------------------------------------------------------------------------------------------------- | :-------------------------------- |
| start-1    |          3 |         1 | {"state":"NOT\_STARTED","seller":"alice","best\_bid":0,"best\_bidder":"none","deadline":1700010000}    | {"auction-start":{}}              |
| bid-1      |          4 |         2 | {"state":"STARTED","seller":"alice","best\_bid":500000,"best\_bidder":"bob","deadline":1700015000}     | {"auction-bid":{"amount":600000}} |
| withdraw-1 |          3 |         1 | {"state":"STARTED","seller":"alice","best\_bid":700000,"best\_bidder":"charlie","deadline":1700017000} | {"auction-withdraw":{}}           |
| end-1      |          2 |         1 | {"state":"OUTBID","seller":"alice","best\_bid":800000,"best\_bidder":"eve","deadline":1700020000}      | {"auction-end":{}}                |


### Output Trace

| ID         | Size (bytes) | Fees (lovelace) |
| :--------- | -----------: | --------------: |
| start-1    |         4512 |          201234 |
| bid-1      |         4518 |          203456 |
| withdraw-1 |         4520 |          204012 |
| end-1      |         4524 |          204789 |


---

## Htlc

### Input Trace

| ID        | N accounts | N signers | Datum                                                                                  | Redeemer                          |
| :-------- | ---------: | --------: | :------------------------------------------------------------------------------------- | :-------------------------------- |
| reveal-1  |          2 |         1 | {"committer":"alice","receiver":"bob","secret\_hash":"xyz123","timeout":1700030000}    | {"Reveal":{"secret":"secret123"}} |
| timeout-1 |          1 |         1 | {"committer":"carol","receiver":"dave","secret\_hash":"abc789","timeout":1700035000}   | {"Timeout":{}}                    |
| reveal-2  |          2 |         1 | {"committer":"eve","receiver":"frank","secret\_hash":"def456","timeout":1700040000}    | {"Reveal":{"secret":"secret789"}} |
| reveal-3  |          2 |         1 | {"committer":"george","receiver":"harry","secret\_hash":"ghi012","timeout":1700045000} | {"Reveal":{"secret":"secret345"}} |


### Output Trace

| ID        | Size (bytes) | Fees (lovelace) |
| :-------- | -----------: | --------------: |
| reveal-1  |         4021 |          180321 |
| timeout-1 |         4023 |          181000 |
| reveal-2  |         4025 |          181234 |
| reveal-3  |         4027 |          181567 |

---

## Simple Transfer

### Input Trace

| ID         | N accounts | N signers | Datum                                                                    | Redeemer                       |
| :--------- | ---------: | --------: | :----------------------------------------------------------------------- | :----------------------------- |
| deposit-1  |          2 |         1 | {"owner":"alice","recipient":"bob","initialization\_amount":1000000}     | {"Deposit":{"amount":500000}}  |
| withdraw-1 |          2 |         1 | {"owner":"alice","recipient":"bob","initialization\_amount":1000000}     | {"Withdraw":{"amount":300000}} |
| deposit-2  |          2 |         1 | {"owner":"charlie","recipient":"diane","initialization\_amount":1500000} | {"Deposit":{"amount":700000}}  |
| withdraw-2 |          2 |         1 | {"owner":"charlie","recipient":"diane","initialization\_amount":1500000} | {"Withdraw":{"amount":400000}} |


### Output Trace

| ID         | Size (bytes) | Fees (lovelace) |
| :--------- | -----------: | --------------: |
| deposit-1  |         3605 |          190123 |
| withdraw-1 |         3607 |          190456 |
| deposit-2  |         3609 |          190789 |
| withdraw-2 |         3611 |          191012 |


---

## Vesting

### Input Trace

| ID        | N accounts | N signers | Datum                                                                                      | Redeemer                       |
| :-------- | ---------: | --------: | :----------------------------------------------------------------------------------------- | :----------------------------- |
| release-1 |          1 |         1 | {"beneficiary":"bob","start\_timestamp":1700050000,"duration":31536000,"amount":10000000}  | {"Release":{"amount":2500000}} |
| release-2 |          1 |         1 | {"beneficiary":"bob","start\_timestamp":1700050000,"duration":31536000,"amount":10000000}  | {"Release":{"amount":2500000}} |
| release-3 |          1 |         1 | {"beneficiary":"carol","start\_timestamp":1700055000,"duration":15768000,"amount":5000000} | {"Release":{"amount":1000000}} |
| release-4 |          1 |         1 | {"beneficiary":"carol","start\_timestamp":1700055000,"duration":15768000,"amount":5000000} | {"Release":{"amount":2000000}} |


### Output Trace

| ID        | Size (bytes) | Fees (lovelace) |
| :-------- | -----------: | --------------: |
| release-1 |         3391 |          232777 |
| release-2 |         3391 |          232777 |
| release-3 |         3395 |          232865 |
| release-4 |         3395 |          232865 |

