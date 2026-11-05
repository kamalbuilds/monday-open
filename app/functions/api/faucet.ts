// Devnet-only drip. Cloudflare egress is blocked by the public devnet RPC, so this only
// signs a fixed 0.02 SOL transfer against a client-supplied blockhash; the browser submits it.
import { Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
export const onRequestPost: PagesFunction<{ FAUCET_KEY: string }> = async ({ request, env }) => {
  try {
    const { to, blockhash } = (await request.json()) as { to: string; blockhash: string };
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env.FAUCET_KEY)));
    const t = new Transaction({ feePayer: kp.publicKey, recentBlockhash: blockhash })
      .add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(to), lamports: 0.02 * LAMPORTS_PER_SOL }));
    t.sign(kp);
    return Response.json({ tx: t.serialize().toString("base64") });
  } catch (e: any) { return new Response(String(e?.message ?? e), { status: 500 }); }
};
