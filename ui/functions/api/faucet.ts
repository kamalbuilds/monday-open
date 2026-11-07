// Devnet-only drip. Signs a fixed transfer (0.024 SOL) or a mint of 10 TSLAx devnet test tokens
// against a client-supplied blockhash; the browser submits it. The faucet key is the SOL
// source and the mint authority of the TSLAx devnet test mint. It reads its own balance
// first so an empty faucet answers with a clear message instead of a transaction that
// fails on submit.
import { Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMintToInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
const TSLAX_MINT = new PublicKey("AGZEh6XxRYEmN5HZDYMVciYUFRCiSEhGkVsdDVXkM61T");
const DRIP = Math.round(0.024 * LAMPORTS_PER_SOL);
const TOKEN_DRIP = 10n * 1_000_000n; // 10 shares at 6 decimals
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
    const { to, blockhash, token } = (await request.json()) as { to: string; blockhash: string; token?: boolean };
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env.FAUCET_KEY)));
    let bal: number;
    try { bal = await faucetBalance(kp.publicKey.toBase58(), env.RPC_URL); }
    catch (e: any) { return Response.json({ error: "Faucet balance could not be read. Try again in a moment.", detail: String(e?.message ?? e) }, { status: 503 }); }
    const need = (token ? 0 : DRIP) + FEE_BUFFER;
    if (bal < need) {
      return Response.json({ error: `Faucet is empty (${(bal / LAMPORTS_PER_SOL).toFixed(4)} SOL left). Get devnet SOL at faucet.solana.com and send it to ${kp.publicKey.toBase58()}.`, faucet: kp.publicKey.toBase58(), balance: bal }, { status: 503 });
    }
    const dest = new PublicKey(to);
    const ix = token
      ? createMintToInstruction(TSLAX_MINT, getAssociatedTokenAddressSync(TSLAX_MINT, dest), kp.publicKey, TOKEN_DRIP)
      : SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: dest, lamports: DRIP });
    const t = new Transaction({ feePayer: kp.publicKey, recentBlockhash: blockhash }).add(ix);
    t.sign(kp);
    return Response.json({ tx: t.serialize().toString("base64"), balance: bal });
  } catch (e: any) { return Response.json({ error: String(e?.message ?? e) }, { status: 500 }); }
};
