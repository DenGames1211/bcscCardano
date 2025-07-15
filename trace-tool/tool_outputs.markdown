#### Execution Trace: Bet Contract
| ID     | N\_accounts | N\_signers | Datum                                                                                                 | Redeemer              |
| ------ | ----------- | ---------- | ----------------------------------------------------------------------------------------------------- | --------------------- |
| bet\_1 | 2           | 1          | `{oracle:abc123,wager:1000000,player_1:playerA,player_2:playerB,deadline:1700000000,is_joined:false}` | `Join{wager:1000000}` |
| bet\_2 | 2           | 2          | `{oracle:abc123,wager:1000000,player_1:playerA,player_2:playerB,deadline:1700000000,is_joined:true}`  | `Win{winner:playerB}` |
| bet\_3 | 1           | 1          | `{oracle:abc123,wager:1500000,player_1:playerC,player_2:playerD,deadline:1700005000,is_joined:false}` | `Timeout`             |
| bet\_4 | 2           | 1          | `{oracle:def456,wager:2000000,player_1:playerE,player_2:playerF,deadline:1700007000,is_joined:false}` | `Join{wager:2000000}` |


#### Execution Trace: Auction Contract
| ID         | N\_accounts | N\_signers | Datum                                                                                  | Redeemer                     |
| ---------- | ----------- | ---------- | -------------------------------------------------------------------------------------- | ---------------------------- |
| auction\_1 | 3           | 1          | `{state:NOT_STARTED,seller:alice,best_bid:0,best_bidder:none,deadline:1700010000}`     | `auction-start`              |
| auction\_2 | 4           | 2          | `{state:STARTED,seller:alice,best_bid:500000,best_bidder:bob,deadline:1700015000}`     | `auction-bid{amount:600000}` |
| auction\_3 | 3           | 1          | `{state:STARTED,seller:alice,best_bid:700000,best_bidder:charlie,deadline:1700017000}` | `auction-withdraw`           |
| auction\_4 | 2           | 1          | `{state:OUTBID,seller:alice,best_bid:800000,best_bidder:eve,deadline:1700020000}`      | `auction-end`                |


#### Execution Trace: HTLC Contract
| ID      | N\_accounts | N\_signers | Datum                                                                     | Redeemer                   |
| ------- | ----------- | ---------- | ------------------------------------------------------------------------- | -------------------------- |
| htlc\_1 | 2           | 1          | `{committer:alice,receiver:bob,secret_hash:xyz123,timeout:1700030000}`    | `Reveal{secret:secret123}` |
| htlc\_2 | 1           | 1          | `{committer:carol,receiver:dave,secret_hash:abc789,timeout:1700035000}`   | `Timeout`                  |
| htlc\_3 | 2           | 1          | `{committer:eve,receiver:frank,secret_hash:def456,timeout:1700040000}`    | `Reveal{secret:secret789}` |
| htlc\_4 | 2           | 1          | `{committer:george,receiver:harry,secret_hash:ghi012,timeout:1700045000}` | `Reveal{secret:secret345}` |


#### Execution Trace: Simple Transfer Contract
| ID          | N\_accounts | N\_signers | Datum                                                           | Redeemer                  |
| ----------- | ----------- | ---------- | --------------------------------------------------------------- | ------------------------- |
| transfer\_1 | 2           | 1          | `{owner:alice,recipient:bob,initialization_amount:1000000}`     | `Deposit{amount:500000}`  |
| transfer\_2 | 2           | 1          | `{owner:alice,recipient:bob,initialization_amount:1000000}`     | `Withdraw{amount:300000}` |
| transfer\_3 | 2           | 1          | `{owner:charlie,recipient:diane,initialization_amount:1500000}` | `Deposit{amount:700000}`  |
| transfer\_4 | 2           | 1          | `{owner:charlie,recipient:diane,initialization_amount:1500000}` | `Withdraw{amount:400000}` |


#### Execution Trace: Vesting Contract
| ID         | N\_accounts | N\_signers | Datum                                                                             | Redeemer                  |
| ---------- | ----------- | ---------- | --------------------------------------------------------------------------------- | ------------------------- |
| vesting\_1 | 1           | 1          | `{beneficiary:bob,start_timestamp:1700050000,duration:31536000,amount:10000000}`  | `Release{amount:2500000}` |
| vesting\_2 | 1           | 1          | `{beneficiary:bob,start_timestamp:1700050000,duration:31536000,amount:10000000}`  | `Release{amount:2500000}` |
| vesting\_3 | 1           | 1          | `{beneficiary:carol,start_timestamp:1700055000,duration:15768000,amount:5000000}` | `Release{amount:1000000}` |
| vesting\_4 | 1           | 1          | `{beneficiary:carol,start_timestamp:1700055000,duration:15768000,amount:5000000}` | `Release{amount:2000000}` |
