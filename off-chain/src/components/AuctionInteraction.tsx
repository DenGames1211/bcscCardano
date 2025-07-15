'use client';

import React, { useState } from 'react';
import AuctionDeploy from '@/components/AuctionDeploy';
import AuctionStart from '@/components/AuctionStart';

export default function AuctionSellerUX() {
  const [object, setObject] = useState('');
  const [deadline, setDeadline] = useState<bigint>(0n);

  return (
    <div className="w-full max-w-3xl mx-auto mt-10">
      
      {/* Deploy Section */}
      <div className="bg-white p-6 rounded-xl shadow-md mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Deploy Auction</h2>
        <AuctionDeploy
          onDeploy={(obj: string, dl: bigint) => {
            setObject(obj);
            setDeadline(dl);
          }}
        />
      </div>

      {/* Start Section */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">2. Start Auction</h2>
        <AuctionStart object={object} deadline={deadline} />
      </div>
    </div>
  );
}

