//! MONDAY OPEN: a sealed weekend batch auction that prints one uniform Monday-open
//! price for a tokenized stock. Orders are committed as hashes over the weekend,
//! revealed before the open, and cleared at a single price that maximizes matched volume.
//! Buyers escrow SOL at commit. Sellers escrow the stock token at reveal, so the side
//! stays sealed until the open. Settlement delivers tokens to buyers and SOL to sellers.
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use solana_sha256_hasher::hashv;

declare_id!("BK1xCrXCRS3PaayeD93T69YCaAEkWQXaW1sYCzseCusA");

/// Lamports escrowed per price tick per share.
pub const LAMPORTS_PER_TICK: u64 = 1_000;
/// Base units of the stock token per share (6 decimals).
pub const TOKENS_PER_SHARE: u64 = 1_000_000;
pub const MAX_ORDERS: usize = 24;
pub const MAX_FEE_BPS: u16 = 1_000;

#[program]
pub mod monday_open {
    use super::*;

    /// One-time protocol config. Only the program's upgrade authority can set it.
    pub fn init_config(ctx: Context<InitConfig>, fee_bps: u16, treasury: Pubkey) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, MoError::FeeTooHigh);
        let c = &mut ctx.accounts.config;
        c.authority = ctx.accounts.authority.key();
        c.treasury = treasury;
        c.fee_bps = fee_bps;
        c.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn create_auction(
        ctx: Context<CreateAuction>,
        auction_id: u64,
        symbol: String,
        friday_close: u64,
        commit_end: i64,
        reveal_end: i64,
    ) -> Result<()> {
        require!(symbol.len() <= 12, MoError::SymbolTooLong);
        require!(commit_end < reveal_end, MoError::BadWindow);
        let a = &mut ctx.accounts.auction;
        a.authority = ctx.accounts.authority.key();
        a.auction_id = auction_id;
        a.symbol = symbol;
        a.friday_close = friday_close;
        a.commit_end = commit_end;
        a.reveal_end = reveal_end;
        a.order_count = 0;
        a.revealed_count = 0;
        a.cleared = false;
        a.clear_price = 0;
        a.matched_qty = 0;
        a.buy_eligible = 0;
        a.sell_eligible = 0;
        a.bump = ctx.bumps.auction;
        a.vault_bump = ctx.bumps.vault;
        a.mint = ctx.accounts.mint.key();
        a.treasury = ctx.accounts.config.treasury;
        a.fee_bps = ctx.accounts.config.fee_bps;
        Ok(())
    }

    /// Seal an order: only a hash and a deposit are public.
    pub fn commit_order(ctx: Context<CommitOrder>, commitment: [u8; 32], deposit: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = &mut ctx.accounts.auction;
        require!(now < a.commit_end, MoError::CommitClosed);
        require!((a.order_count as usize) < MAX_ORDERS, MoError::BookFull);
        require!(deposit > 0, MoError::ZeroDeposit);
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.trader.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            deposit,
        )?;
        let o = &mut ctx.accounts.order;
        o.auction = a.key();
        o.trader = ctx.accounts.trader.key();
        o.index = a.order_count;
        o.commitment = commitment;
        o.deposit = deposit;
        o.revealed = false;
        o.side = 0;
        o.price = 0;
        o.qty = 0;
        o.filled = 0;
        o.settled = false;
        o.bump = ctx.bumps.order;
        a.order_count += 1;
        Ok(())
    }

    /// Open the seal. side: 0 = buy, 1 = sell. price in ticks. A buy must be fully
    /// funded in SOL. A sell moves `qty * TOKENS_PER_SHARE` stock tokens into escrow.
    pub fn reveal_order(ctx: Context<RevealOrder>, side: u8, price: u64, qty: u64, salt: [u8; 32]) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = &mut ctx.accounts.auction;
        require!(now >= a.commit_end, MoError::RevealNotOpen);
        require!(now < a.reveal_end, MoError::RevealClosed);
        let o = &mut ctx.accounts.order;
        require!(!o.revealed, MoError::AlreadyRevealed);
        require!(side <= 1 && price > 0 && qty > 0, MoError::BadOrder);
        let h = commitment_hash(side, price, qty, &salt, &o.trader);
        require!(h == o.commitment, MoError::BadReveal);
        if side == 0 {
            let need = qty.checked_mul(price).and_then(|v| v.checked_mul(LAMPORTS_PER_TICK)).ok_or(MoError::Overflow)?;
            require!(o.deposit >= need, MoError::Underfunded);
        } else {
            let tokens = qty.checked_mul(TOKENS_PER_SHARE).ok_or(MoError::Overflow)?;
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.trader_ata.to_account_info(),
                        to: ctx.accounts.token_vault.to_account_info(),
                        authority: ctx.accounts.trader.to_account_info(),
                    },
                ),
                tokens,
            )?;
        }
        o.revealed = true;
        o.side = side;
        o.price = price;
        o.qty = qty;
        a.revealed_count += 1;
        Ok(())
    }

    /// Monday open: anyone cranks with every revealed order as writable remaining accounts.
    /// Fixes the clearing price and writes each order's exact fill, so the heavy side's
    /// fills sum to the matched quantity.
    pub fn clear<'info>(ctx: Context<'_, '_, 'info, 'info, Clear<'info>>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = &mut ctx.accounts.auction;
        require!(now >= a.reveal_end, MoError::NotOpenYet);
        require!(!a.cleared, MoError::AlreadyCleared);
        let mut orders: Vec<(u8, u64, u64)> = Vec::new();
        let mut revealed: Vec<Account<'info, Order>> = Vec::new();
        let mut seen: Vec<u16> = Vec::new();
        for acc in ctx.remaining_accounts.iter() {
            let o: Account<Order> = Account::try_from(acc)?;
            require_keys_eq!(o.auction, a.key(), MoError::WrongAuction);
            require!(!seen.contains(&o.index), MoError::DuplicateOrder);
            seen.push(o.index);
            if o.revealed {
                require!(acc.is_writable, MoError::OrderNotWritable);
                orders.push((o.side, o.price, o.qty));
                revealed.push(o);
            }
        }
        require!(orders.len() as u16 == a.revealed_count, MoError::MissingOrders);
        let (p, m, be, se) = compute_clearing(&orders, a.friday_close);
        let fills = allocate_fills(&orders, p, m);
        for (o, f) in revealed.iter_mut().zip(fills) {
            o.filled = f;
            o.exit(&crate::ID)?;
        }
        a.clear_price = p;
        a.matched_qty = m;
        a.buy_eligible = be;
        a.sell_eligible = se;
        a.cleared = true;
        emit!(Cleared { auction: a.key(), price: p, matched: m });
        Ok(())
    }

    /// Pay out one order. Buyer: stock tokens for the fill, SOL refund of the unspent
    /// escrow. Seller: SOL proceeds minus the fee, stock tokens refunded for the unfilled part.
    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        let a = &ctx.accounts.auction;
        require!(a.cleared, MoError::NotCleared);
        let o = &mut ctx.accounts.order;
        require!(!o.settled, MoError::AlreadySettled);
        let mut payout = o.deposit;
        let mut fee = 0u64;
        let mut tokens = 0u64;
        if o.revealed {
            let notional = o.filled
                .checked_mul(a.clear_price)
                .and_then(|v| v.checked_mul(LAMPORTS_PER_TICK))
                .ok_or(MoError::Overflow)?;
            if o.side == 0 {
                payout = o.deposit.checked_sub(notional).ok_or(MoError::Overflow)?;
                tokens = o.filled * TOKENS_PER_SHARE;
            } else {
                fee = fee_of(notional, a.fee_bps);
                payout = o.deposit.checked_add(notional - fee).ok_or(MoError::Overflow)?;
                tokens = (o.qty - o.filled) * TOKENS_PER_SHARE;
            }
        }
        o.settled = true;
        let auction_key = a.key();
        let seeds: &[&[u8]] = &[b"vault", auction_key.as_ref(), &[a.vault_bump]];
        if tokens > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.token_vault.to_account_info(),
                        to: ctx.accounts.trader_ata.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    &[seeds],
                ),
                tokens,
            )?;
        }
        if payout > 0 {
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.trader.to_account_info(),
                    },
                    &[seeds],
                ),
                payout,
            )?;
        }
        if fee > 0 {
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                    &[seeds],
                ),
                fee,
            )?;
        }
        Ok(())
    }
}

pub fn commitment_hash(side: u8, price: u64, qty: u64, salt: &[u8; 32], trader: &Pubkey) -> [u8; 32] {
    hashv(&[&[side][..], &price.to_le_bytes(), &qty.to_le_bytes(), salt, trader.as_ref()]).to_bytes()
}

/// Protocol fee on a seller's proceeds, rounded down.
pub fn fee_of(notional: u64, fee_bps: u16) -> u64 {
    ((notional as u128) * (fee_bps as u128) / 10_000) as u64
}

/// Split `matched` across `qtys` in proportion to size. Floors first, then hands the
/// leftover units to the largest remainders (lowest index wins ties), so the result
/// sums to exactly `matched` and no fill exceeds its quantity. Needs matched <= sum(qtys).
pub fn allocate(qtys: &[u64], matched: u64) -> Vec<u64> {
    let total: u128 = qtys.iter().map(|&q| q as u128).sum();
    if total == 0 { return vec![0; qtys.len()]; }
    let share = |q: u64| (q as u128) * (matched as u128);
    let mut out: Vec<u64> = qtys.iter().map(|&q| (share(q) / total) as u64).collect();
    let mut left = matched - out.iter().sum::<u64>();
    let mut by_rem: Vec<usize> = (0..qtys.len()).collect();
    by_rem.sort_by(|&i, &j| (share(qtys[j]) % total).cmp(&(share(qtys[i]) % total)).then(i.cmp(&j)));
    for i in by_rem {
        if left == 0 { break; }
        out[i] += 1;
        left -= 1;
    }
    out
}

/// Per-order fills at the clearing price: the eligible orders of each side share `matched`.
pub fn allocate_fills(orders: &[(u8, u64, u64)], price: u64, matched: u64) -> Vec<u64> {
    let mut fills = vec![0u64; orders.len()];
    if matched == 0 { return fills; }
    for side in 0..=1u8 {
        let idx: Vec<usize> = (0..orders.len())
            .filter(|&i| orders[i].0 == side && if side == 0 { orders[i].1 >= price } else { orders[i].1 <= price })
            .collect();
        let qtys: Vec<u64> = idx.iter().map(|&i| orders[i].2).collect();
        for (k, f) in allocate(&qtys, matched).into_iter().enumerate() { fills[idx[k]] = f; }
    }
    fills
}

/// Uniform price: maximize matched volume, then minimize imbalance, then stay closest
/// to the Friday close. Returns (price, matched, buy_eligible, sell_eligible).
pub fn compute_clearing(orders: &[(u8, u64, u64)], reference: u64) -> (u64, u64, u64, u64) {
    let mut best = (0u64, 0u64, 0u64, 0u64);
    let mut best_key: Option<(u64, u64, u64)> = None;
    for &(_, cand, _) in orders {
        let d: u64 = orders.iter().filter(|o| o.0 == 0 && o.1 >= cand).map(|o| o.2).sum();
        let s: u64 = orders.iter().filter(|o| o.0 == 1 && o.1 <= cand).map(|o| o.2).sum();
        let m = d.min(s);
        if m == 0 { continue; }
        let key = (m, u64::MAX - d.abs_diff(s), u64::MAX - cand.abs_diff(reference));
        if best_key.map_or(true, |k| key > k) {
            best_key = Some(key);
            best = (cand, m, d, s);
        }
    }
    best
}

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(init, payer = authority, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, crate::program::MondayOpen>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ MoError::NotUpgradeAuthority)]
    pub program_data: Account<'info, ProgramData>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(auction_id: u64)]
pub struct CreateAuction<'info> {
    #[account(init, payer = authority, space = 8 + Auction::INIT_SPACE,
        seeds = [b"auction", authority.key().as_ref(), &auction_id.to_le_bytes()], bump)]
    pub auction: Account<'info, Auction>,
    /// CHECK: lamport vault PDA, system-owned; also the authority of the token vault
    #[account(mut, seeds = [b"vault", auction.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    #[account(init, payer = authority, seeds = [b"tvault", auction.key().as_ref()], bump,
        token::mint = mint, token::authority = vault)]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CommitOrder<'info> {
    #[account(mut)]
    pub auction: Account<'info, Auction>,
    #[account(init, payer = trader, space = 8 + Order::INIT_SPACE,
        seeds = [b"order", auction.key().as_ref(), &auction.order_count.to_le_bytes()], bump)]
    pub order: Account<'info, Order>,
    /// CHECK: vault PDA
    #[account(mut, seeds = [b"vault", auction.key().as_ref()], bump = auction.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub trader: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealOrder<'info> {
    #[account(mut)]
    pub auction: Account<'info, Auction>,
    #[account(mut, has_one = auction, has_one = trader)]
    pub order: Account<'info, Order>,
    #[account(mut, token::mint = auction.mint, token::authority = trader)]
    pub trader_ata: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"tvault", auction.key().as_ref()], bump)]
    pub token_vault: Account<'info, TokenAccount>,
    pub trader: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Clear<'info> {
    #[account(mut)]
    pub auction: Account<'info, Auction>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    pub auction: Account<'info, Auction>,
    #[account(mut, has_one = auction, has_one = trader)]
    pub order: Account<'info, Order>,
    /// CHECK: vault PDA
    #[account(mut, seeds = [b"vault", auction.key().as_ref()], bump = auction.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: receives payout; bound by has_one on order
    #[account(mut)]
    pub trader: UncheckedAccount<'info>,
    #[account(mut, token::mint = auction.mint, token::authority = trader)]
    pub trader_ata: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"tvault", auction.key().as_ref()], bump)]
    pub token_vault: Account<'info, TokenAccount>,
    /// CHECK: fee destination, pinned to the treasury recorded on the auction
    #[account(mut, address = auction.treasury)]
    pub treasury: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Auction {
    pub authority: Pubkey,
    pub auction_id: u64,
    #[max_len(12)]
    pub symbol: String,
    pub friday_close: u64,
    pub commit_end: i64,
    pub reveal_end: i64,
    pub order_count: u16,
    pub revealed_count: u16,
    pub cleared: bool,
    pub clear_price: u64,
    pub matched_qty: u64,
    pub buy_eligible: u64,
    pub sell_eligible: u64,
    pub bump: u8,
    pub vault_bump: u8,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
}

#[account]
#[derive(InitSpace)]
pub struct Order {
    pub auction: Pubkey,
    pub trader: Pubkey,
    pub index: u16,
    pub commitment: [u8; 32],
    pub deposit: u64,
    pub revealed: bool,
    pub side: u8,
    pub price: u64,
    pub qty: u64,
    pub filled: u64,
    pub settled: bool,
    pub bump: u8,
}

#[event]
pub struct Cleared { pub auction: Pubkey, pub price: u64, pub matched: u64 }

#[error_code]
pub enum MoError {
    SymbolTooLong, BadWindow, CommitClosed, BookFull, ZeroDeposit, RevealNotOpen, RevealClosed,
    AlreadyRevealed, BadOrder, BadReveal, Underfunded, Overflow, NotOpenYet, AlreadyCleared,
    WrongAuction, DuplicateOrder, MissingOrders, NotCleared, AlreadySettled,
    FeeTooHigh, NotUpgradeAuthority, OrderNotWritable,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn uniform_price_maximizes_volume() {
        // buys: 10@105, 5@101 ; sells: 8@99, 6@103
        let o = vec![(0, 105, 10), (0, 101, 5), (1, 99, 8), (1, 103, 6)];
        let (p, m, d, s) = compute_clearing(&o, 100);
        assert_eq!((p, m), (103, 10));
        assert_eq!((d, s), (10, 14));
    }
    #[test]
    fn no_cross_no_trade() {
        let o = vec![(0, 90, 10), (1, 110, 10)];
        assert_eq!(compute_clearing(&o, 100).1, 0);
    }
    #[test]
    fn heavy_side_fills_sum_to_matched() {
        // buys 5/5/5 against a sell of 10: floor(5*10/15) = 3 each paid out only 9 shares.
        let o = vec![(0, 100, 5), (0, 100, 5), (0, 100, 5), (1, 100, 10)];
        let (p, m, _, _) = compute_clearing(&o, 100);
        assert_eq!(m, 10);
        let f = allocate_fills(&o, p, m);
        assert_eq!(f[..3].iter().sum::<u64>(), 10, "buyers must receive every matched share: {:?}", f);
        assert_eq!(f[3], 10);
        assert!(f[..3].iter().all(|&x| x == 3 || x == 4));
    }
    #[test]
    fn allocation_is_exact_and_capped() {
        for a in 1..=7u64 { for b in 1..=7 { for c in 1..=7 {
            let q = [a, b, c];
            for m in 0..=(a + b + c) {
                let f = allocate(&q, m);
                assert_eq!(f.iter().sum::<u64>(), m, "{:?} matched {}", q, m);
                assert!(f.iter().zip(q).all(|(&x, y)| x <= y), "{:?} matched {} -> {:?}", q, m, f);
            }
        }}}
    }
    #[test]
    fn light_side_is_filled_in_full() {
        let o = vec![(0, 105, 10), (0, 101, 5), (1, 99, 8), (1, 103, 6)];
        let (p, m, _, _) = compute_clearing(&o, 100);
        assert_eq!(allocate_fills(&o, p, m), vec![10, 0, 6, 4]);
    }
    #[test]
    fn fee_rounds_down_in_bps() {
        assert_eq!(fee_of(3_800_000, 10), 3_800);
        assert_eq!(fee_of(999, 10), 0);
        assert_eq!(fee_of(1_000_000, 0), 0);
    }
}
