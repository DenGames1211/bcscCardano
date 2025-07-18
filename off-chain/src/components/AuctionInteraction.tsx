'use client';

import React, { useState } from 'react';
import AuctionDeploy from '@/components/AuctionDeploy';
import AuctionStart from '@/components/AuctionStart';
import AuctionBid from '@/components/AuctionBid';
import AuctionWithdraw from './AuctionWithdraw';

export function AuctionSellerUX() {
  const [object, setObject] = useState('');
  const [deadline, setDeadline] = useState<bigint>(0n);

  const isDeployed = object !== '' && deadline > 0n;

  return (
    <div className="w-full max-w-3xl mx-auto mt-2">
      {/* Deploy Section */}
      <div className="bg-white p-3 rounded-xl shadow-md mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Deploy Auction</h2>
        <AuctionDeploy
          onDeploy={(obj: string, dl: bigint) => {
            setObject(obj);
            setDeadline(dl);
          }}
        />
      </div>

      {/* Start Section */}
      <div className="bg-white p-3 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">2. Manage Auction</h2>
        <AuctionStart object={object} deadline={deadline} />
      </div>
    </div>
  );
}

export default function AuctionBidderUX() {
  return (
    <div className="w-full max-w-4xl mx-auto mt-4">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Bidder panel</h2>

      {/* Panel 1: Make a Bid */}
      <div className="bg-white p-6 rounded-xl shadow-md mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Make a Bid</h2>
        <AuctionBid />
      </div>

      {/* Panel 2: Active Bids */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">2. Active Bids</h2>
        <AuctionWithdraw></AuctionWithdraw>
      </div>
    </div>
  );
}
