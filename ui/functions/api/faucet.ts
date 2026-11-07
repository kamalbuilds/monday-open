// Devnet-only drip. Signs a fixed 0.012 SOL transfer against a client-supplied blockhash;
// the browser submits it. Reads the faucet balance first so an empty faucet answers with a
// clear message instead of a transaction that fails on submit.
import { Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
const DRIP = Math.round(0.012 * LAMPORTS_PER_SOL);
const FEE_BUFFER = 10_000; // fee for the drip tx plus headroom
const RPCS = ["https://api.devnet.solana.com", "https://rpc.ankr.com/solana_devnet"];

async function faucetBalance(addr: string, extra?: string): Promise<number> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [addr, { commitment: "confirmed" }] });
  let last = "no rpc";
  for (const url of [...(extra ? [extra] : []), ...RPCS]) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      const j = (await r.json()) as { result?: { value: number }; error?: { message: string } };
      if (j.result) return j.result.value;
      last = j.error?.message ?? `rpc ${r.status}`;
    } catch (e: any) { last = String(e?.message ?? e); }
  }
  throw new Error(last);
}

export const onRequestPost: PagesFunction<{ FAUCET_KEY: string; RPC_URL?: string }> = async ({ request, env }) => {
  try {
    const { to, blockhash } = (await request.json()) as { to: string; blockhash: string };
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env.FAUCET_KEY)));
    let bal: number;
    try { bal = await faucetBalance(kp.publicKey.toBase58(), env.RPC_URL); }
    catch (e: any) { return Response.json({ error: "Faucet balance could not be read. Try again in a moment.", detail: String(e?.message ?? e) }, { status: 503 }); }
    if (bal < DRIP + FEE_BUFFER) {
      return Response.json({ error: `Faucet is empty (${(bal / LAMPORTS_PER_SOL).toFixed(4)} SOL left). Get devnet SOL at faucet.solana.com and send it to ${kp.publicKey.toBase58()}.`, faucet: kp.publicKey.toBase58(), balance: bal }, { status: 503 });
    }
    const t = new Transaction({ feePayer: kp.publicKey, recentBlockhash: blockhash })
      .add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(to), lamports: DRIP }));
    t.sign(kp);
    return Response.json({ tx: t.serialize().toString("base64"), balance: bal });
  } catch (e: any) { return Response.json({ error: String(e?.message ?? e) }, { status: 500 }); }
};
