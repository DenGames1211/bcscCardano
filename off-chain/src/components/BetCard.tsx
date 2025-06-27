// src/components/BetCard.tsx
import React from 'react';
import { BetDatum } from '../utils/lucid';

interface BetCardProps {
  datum: BetDatum;
}

export default function BetCard({ datum }: BetCardProps) {
  const {
    oracle,
    wager,
    player_1,
    player_2,
    deadline,
    is_joined
  } = datum;

  const formatTime = (ms: bigint) => {
    const date = new Date(Number(ms));
    return date.toLocaleString();
  };

  return (
    <div className="border rounded-lg p-4 shadow-md bg-white">
      <h2 className="text-xl font-semibold mb-2">Scommessa</h2>
      <ul className="space-y-1 text-sm">
        <li><strong>Oracle:</strong> {oracle}</li>
        <li><strong>Wager:</strong> {Number(wager)} ADA</li>
        <li><strong>Player 1:</strong> {player_1}</li>
        <li><strong>Player 2:</strong> {player_2}</li>
        <li><strong>Deadline:</strong> {formatTime(deadline)}</li>
        <li><strong>Joined:</strong> {is_joined ? 'Sì' : 'No'}</li>
      </ul>
    </div>
  );
}
