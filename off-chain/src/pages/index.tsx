import { useState } from "react";
import type { NextPage } from "next";
import { useWallet } from '@meshsdk/react';
import { CardanoWallet } from '@meshsdk/react';
import ConnectWallet from "@/components/ConnectWallet";
import BetInteraction from "@/components/BetInteraction_";
import AuctionSellerUX from "@/components/AuctionInteraction";
import AuctionBidderUX from "@/components/AuctionInteraction"; 

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-10 border border-blue-100">
        <h1 className="text-4xl font-extrabold text-center text-blue-700 mb-8 tracking-tight">
          Cardano Auction dApp
        </h1>

        <div className="flex flex-col gap-10">
          <section className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-inner">
            <ConnectWallet />
          </section>

          <section>
            <AuctionBidderUX />
          </section>
        </div>
      </div>
    </main>
  );
}