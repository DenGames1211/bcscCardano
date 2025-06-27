// pages/index.tsx
import ConnectWallet from '@/components/ConnectWallet';
import DeployButton from '@/components/DeployButton';

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl mb-4">Cardano Bet dApp</h1>
      <ConnectWallet />
      <div className="mt-6">
        <DeployButton />
      </div>
    </main>
  );
}