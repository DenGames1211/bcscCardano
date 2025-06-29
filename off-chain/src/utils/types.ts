// utils/types.ts
import { mConStr0 } from "@meshsdk/core";

/// The on-chain Bet datum (constructor index 0) has this shape:
///   (oracle      :: VerificationKeyHash)
///   (wager       :: Lovelace)
///   (player_1    :: VerificationKeyHash)
///   (player_2    :: VerificationKeyHash)
///   (deadline    :: POSIXTime)
///   (is_joined   :: Bool)
export type BetDatum = ReturnType<typeof mConStr0>;

/// A generic Mesh-SDK datum constructor type
export type DatumConstructor<Input> = (input: Input) => BetDatum;
