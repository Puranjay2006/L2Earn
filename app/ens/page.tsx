import { Navbar } from "@/components/navbar";
import { BasenameClaim } from "@/components/basename-claim";

export const metadata = {
  title: "ENS Username Builder | L2Earn",
  description: "Create your own Base Sepolia basename and use it as your on-chain username in L2Earn.",
};

const STEPS = [
  {
    title: "1. Check your label",
    detail:
      "Enter a name and click Check Price. The app queries the Base Sepolia registrar to fetch the current registration cost.",
  },
  {
    title: "2. Register on-chain",
    detail:
      "Click Register to submit an on-chain transaction. The registrar mints ownership of your .basetest.eth name to your wallet.",
  },
  {
    title: "3. Set primary identity",
    detail:
      "Registration is requested with reverseRecord enabled so your wallet can resolve back to your basename in supported displays.",
  },
  {
    title: "4. Display in L2Earn",
    detail:
      "L2Earn resolves your basename on Base Sepolia. If RPC resolution is delayed, the app uses a local cache fallback after successful registration.",
  },
];

export default function EnsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-72px)]">
        <div className="container mx-auto px-4 py-12 md:px-6 md:py-16">
          <header className="mb-10 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Identity</p>
            <h1 className="mb-4 text-4xl font-black tracking-tight text-foreground md:text-5xl">
              Build your ENS username
            </h1>
            <p className="text-lg text-muted-foreground">
              Create your Base Sepolia basename and use it as your wallet username across L2Earn.
            </p>
          </header>

          <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-xl border border-border/60 bg-card/60 p-6 md:p-8">
              <h2 className="mb-4 text-lg font-bold text-foreground">Claim Username</h2>
              <BasenameClaim />
            </div>

            <div className="rounded-xl border border-border/60 bg-card/60 p-6 md:p-8">
              <h2 className="mb-4 text-lg font-bold text-foreground">How it works</h2>
              <div className="space-y-4">
                {STEPS.map((step) => (
                  <div key={step.title} className="rounded-lg border border-border/50 bg-background/40 p-4">
                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                <p className="text-sm font-semibold text-foreground">Network Mode</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This page is configured for Base Sepolia only and registers names with the .basetest.eth suffix.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
