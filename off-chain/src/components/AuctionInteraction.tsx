import React, { useState } from 'react';
import AuctionDeploy from '@/components/AuctionDeploy';
import BetJoin from '@/components/BetJoin';

const tabs = [
  { id: 'deploy', label: 'Deploy' },
  { id: 'join', label: 'Join' },
];

export default function AuctionInteraction() {
  const [activeTab, setActiveTab] = useState('deploy');

  
  return (
    <div className="w-full max-w-3xl mx-auto mt-10">
      {/* Tab Selector */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors duration-200 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'deploy' && <AuctionDeploy />}
        {activeTab === 'join' && <BetJoin />}
      </div>
    </div>
  );
}
