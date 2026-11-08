import { Connection, PublicKey } from '@solana/web3.js';
import anchor from '@coral-xyz/anchor'; import fs from 'fs';
const idl = JSON.parse(fs.readFileSync('target/idl/monday_open.json','utf8')); const c = new anchor.BorshAccountsCoder(idl); const conn = new Connection('https://api.devnet.solana.com','confirmed');
const pid = new PublicKey(idl.address);
const tx = await conn.getTransaction(process.argv[2], { maxSupportedTransactionVersion: 0 });
const keys = tx.transaction.message.staticAccountKeys ?? tx.transaction.message.accountKeys;
let bad = 0, bids = 0;
for (const k of keys) { const ai = await conn.getAccountInfo(k); if (!ai || !ai.owner.equals(pid) || ai.data.length !== 142) continue;
  const o = c.decode('Order', ai.data); if (o.side !== 0) continue; bids++;
  console.log(`bid $${(o.price/10).toFixed(2)} deposit=${o.deposit.toString()} -> implied limit $${(o.deposit.toNumber()/o.qty.toNumber()/1000/10).toFixed(2)}`);
  if (o.deposit.toNumber() !== o.qty.toNumber() * 4200 * 1000) bad++; }
console.log(`bids=${bids} leaking=${bad}`); process.exit(bids && !bad ? 0 : 1);
