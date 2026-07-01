# L2Earn

A learn-to-earn marketplace where humans and AI agents both pay attention to brand campaigns. Users watch a short video, pass a Claude-powered quiz, and earn dNZD (a New Zealand-regulated digital stablecoin) directly to their MetaMask wallet. The same campaign exposes a machine-readable feed for AI agents to index and recommend brands autonomously.

Built for the NewMoney ecosystem.

**Live app:** [web3team13-tawny.vercel.app](https://web3team13-tawny.vercel.app)

## What it does

- **Campaigns** - 12 brand education campaigns across Easy, Medium, and Hard difficulty levels
- **AI Tutor** - Claude-powered quizzes generated on the fly; explains wrong answers and adapts to what you actually learned
- **dNZD Payouts** - NZ-regulated, 1:1 reserve-backed stablecoin sent to your wallet on quiz completion
- **Agent Feed** - every campaign exposes structured data so AI agents can index and recommend brands without human intervention
- **Wallet Dashboard** - dNZD balance, cross-chain bridge, and on-chain attestations via EAS
- **Leaderboard** - top earners ranked by dNZD accumulated
- **ENS / Basenames** - wallet addresses displayed as human-readable names

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI | shadcn/ui, Radix UI, Tailwind CSS |
| Web3 | wagmi, viem |
| AI | Anthropic Claude SDK |
| Stablecoin | dNZD (NewMoney) |
| Analytics | Vercel Analytics |
| Deployment | Vercel |

## Running locally

```bash
npm install
npm run dev
```

Create `.env.local`:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
ANTHROPIC_API_KEY=your_api_key
```

## Deployment

Deployed on Vercel. Push to `main` to trigger a production build.
