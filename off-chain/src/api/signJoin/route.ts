// pages/api/signJoinTx.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  BlockfrostProvider,
  Transaction,
  MeshWallet,
} from '@meshsdk/core';


const blockchainProvider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

// Usa .env.local per sicurezza
const PLAYER2_PRIVATE_KEY_HEX = process.env.PLAYER2_PRIVATE_KEY!;
const BLOCKFROST_API_KEY = process.env.NEXT_PUBLIC_BLOCKFROST_KEY!;

const provider = new BlockfrostProvider(BLOCKFROST_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tx } = req.body;

  if (!tx || typeof tx !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid tx' });
  }

  try {
    const wallet = new MeshWallet({
        networkId: 0, // 0: testnet, 1: mainnet
        fetcher: provider,
        submitter: provider,
        key: {
            type: 'mnemonic',
            words: ["perfect", "pass", "you", "fly", "auto", "soldier", "sauce", "stuff", "reduce", "finish", "carbon", "clerk", "tent", "expect", "surge", "wolf", "busy", "section", "sweet", "brisk", "dove", "seven", "taxi", "kidney"],
        },
    });

    // Firma la tx parzialmente
    const signedTx = await wallet.signTx(tx, true);

    // Submit della transazione firmata
    const txHash = await wallet.submitTx(signedTx);

    return res.status(200).json({ hash: txHash });
  } catch (err: any) {
    console.error('[signJoinTx] Error:', err);
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
