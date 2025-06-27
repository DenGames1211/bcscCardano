import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { initLucid, getScriptUtxos, joinBet, BetDatum } from '@/utils/lucid';
import ConnectWallet from '@/components/ConnectWallet';
import BetCard from '@/components/BetCard';
import { Data } from 'lucid-cardano';

function decodeDatum(raw: unknown): BetDatum {
  // Lucid restituisce il datum come Data.Constr ma sotto forma JS
  const constr = raw as { fields?: unknown[] };
  if (!constr.fields) {
    throw new Error('Formato datum inatteso');
  }
  const [oracle, wager, p1, p2, deadline, is_joined] = constr.fields;

  return {
    oracle: oracle as string,
    wager: BigInt(wager as number | string),
    player_1: p1 as string,
    player_2: p2 as string,
    deadline: BigInt(deadline as number | string),
    is_joined: Boolean(is_joined),
  };
}

export default function JoinPage() {
  const { query } = useRouter();
  const [datum, setDatum] = useState<BetDatum | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query.txId) return;
    (async () => {
      try {
        await initLucid();
        const utxos = await getScriptUtxos();
        const utxo = utxos.find(u => u.txHash === query.txId);
        
        if (utxo?.datum) {
        const decoded = decodeDatum((utxo.datum as any).data ?? utxo.datum);
        setDatum(decoded);
        } else {
          setDatum(null);
        }
      } catch (e) {
        console.error(e);
        setDatum(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [query.txId]);

  if (loading) return <p>Caricamento…</p>;
  if (!datum) return <p>Non ho trovato la scommessa valida.</p>;

  const handleJoin = async () => {
    try {
      await joinBet(datum);
      alert('Join successo!');
    } catch (e) {
      console.error(e);
      alert('Errore nel join.');
    }
  };

  return (
    <div className="p-4">
      <ConnectWallet />
      <BetCard datum={datum} />
      {!datum.is_joined && (
        <button
          onClick={handleJoin}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Partecipa con {Number(datum.wager)} ADA
        </button>
      )}
    </div>
  );
}
