// One-time devnet setup for the escrowed-sell program: the TSLAx devnet test mint, the fee config
// and the treasury. Idempotent. Devnet only. Keys live in .keys/ (gitignored); the signer is
// ~/.config/solana/id.json, the program's upgrade authority.
// Usage: node scripts/setup-devnet.mjs [--fee-bps 10]
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { createMint, getMint } from "@solana/spl-token";
import fs from "fs";
import os from "os";
const { AnchorProvider, Program, Wallet } = anchor;

const RPC = process.env.RPC ?? "https://api.devnet.solana.com";
if (!/devnet|localhost|127\.0\.0\.1/.test(RPC)) throw new Error("setup-devnet.mjs refuses to run off devnet/localnet");
const feeBps = Number(process.argv.includes("--fee-bps") ? process.argv[process.argv.indexOf("--fee-bps") + 1] : 10);
const load = (p) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p))));
const admin = load(os.homedir() + "/.config/solana/id.json");
const mintKp = load(".keys/tslax-mint.json"), treasury = load(".keys/treasury.json"), faucet = load(".keys/faucet.json");
const conn = new Connection(RPC, "confirmed");
const idl = JSON.parse(fs.readFileSync(new URL("../target/idl/monday_open.json", import.meta.url)));
const program = new Program(idl, new AnchorProvider(conn, new Wallet(admin), { commitment: "confirmed" }));
const pid = program.programId;

if (!(await conn.getAccountInfo(mintKp.publicKey))) {
  await createMint(conn, admin, faucet.publicKey, null, 6, mintKp);
  console.log("created TSLAx devnet test mint", mintKp.publicKey.toBase58());
}
const m = await getMint(conn, mintKp.publicKey);
console.log("mint", mintKp.publicKey.toBase58(), "decimals", m.decimals, "mintAuthority", m.mintAuthority?.toBase58());

if ((await conn.getBalance(treasury.publicKey)) < 0.01 * LAMPORTS_PER_SOL) {
  await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: treasury.publicKey, lamports: 0.01 * LAMPORTS_PER_SOL })), [admin]);
  console.log("funded treasury 0.01 SOL (keeps it rent-exempt so fee transfers always land)");
}
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], pid);
const [programData] = PublicKey.findProgramAddressSync([pid.toBuffer()], new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"));
if (!(await conn.getAccountInfo(config))) {
  const sig = await program.methods.initConfig(feeBps, treasury.publicKey).accountsPartial({ config, program: pid, programData, authority: admin.publicKey }).rpc();
  console.log("init_config", sig);
}
const c = await program.account.config.fetch(config);
const out = { program: pid.toBase58(), mint: mintKp.publicKey.toBase58(), mintName: "TSLAx devnet test mint", decimals: 6, mintAuthority: faucet.publicKey.toBase58(),
  config: config.toBase58(), treasury: c.treasury.toBase58(), feeBps: c.feeBps };
fs.writeFileSync(new URL("./devnet.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(out);
