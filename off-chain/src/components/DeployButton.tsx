import { useState } from 'react';
import { deployBetContract, BetDatum, initLucid } from '@/utils/lucid';

export default function DeployButton() {
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleDeploy = async () => {
    setLoading(true);
    try {
      const lucid = await initLucid();
      const myAddress = await lucid.wallet.address();

      const bet: BetDatum = {
        oracle: 'oracle-pubkey-here',
        wager: 5_000_000n,
        player_1: myAddress,
        player_2: 'addr_test...',
        deadline: BigInt(Date.now() + 3600_000),
        is_joined: false
      };

      const hash = await deployBetContract(bet, bet.wager * 2n);
      setTxHash(hash);
    } catch (err) {
      console.error(err);
      alert('Deploy fallito: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleDeploy} disabled={loading}>
        {loading ? 'Deploy in corso…' : 'Deploy Bet Contract'}
      </button>
      {txHash && <p>TX Hash: {txHash}</p>}
    </div>
  );
}