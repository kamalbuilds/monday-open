//! MONDAY OPEN: a sealed weekend batch auction that prints one uniform Monday-open
//! price for a tokenized stock. Orders are committed as hashes over the weekend,
//! revealed before the open, and cleared at a single price that maximizes matched volume.
use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;
use anchor_lang::system_program;

declare_id!("BK1xCrXCRS3PaayeD93T69YCaAEkWQXaW1sYCzseCusA");

/// Lamports escrowed per price tick (1 tick = $0.01) per share.
pub const LAMPORTS_PER_TICK: u64 = 1_000;
pub const MAX_ORDERS: usize = 24;

#[program]
pub mod monday_open {
    use super::*;

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

    /// Open the seal. side: 0 = buy, 1 = sell. price in ticks ($0.01).
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
        }
        o.revealed = true;
        o.side = side;
        o.price = price;
        o.qty = qty;
        a.revealed_count += 1;
        Ok(())
    }

    /// Monday open: anyone cranks with every revealed order as remaining accounts.
    pub fn clear<'info>(ctx: Context<'_, '_, 'info, 'info, Clear<'info>>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = &mut ctx.accounts.auction;
        require!(now >= a.reveal_end, MoError::NotOpenYet);
        require!(!a.cleared, MoError::AlreadyCleared);
        let mut orders: Vec<(u8, u64, u64)> = Vec::new();
        let mut seen: Vec<u16> = Vec::new();
        for acc in ctx.remaining_accounts.iter() {
            let o: Account<Order> = Account::try_from(acc)?;
            require_keys_eq!(o.auction, a.key(), MoError::WrongAuction);
            require!(!seen.contains(&o.index), MoError::DuplicateOrder);
            seen.push(o.index);
            if o.revealed {
                orders.push((o.side, o.price, o.qty));
            }
        }
        require!(seen.len() as u16 == a.revealed_count.max(seen.len() as u16) && orders.len() as u16 == a.revealed_count, MoError::MissingOrders);
        let (p, m, be, se) = compute_clearing(&orders, a.friday_close);
        a.clear_price = p;
        a.matched_qty = m;
        a.buy_eligible = be;
        a.sell_eligible = se;
        a.cleared = true;
        emit!(Cleared { auction: a.key(), price: p, matched: m });
        Ok(())
    }

    /// Pay out one order: pro-rata fill on the heavy side, refund the rest.
    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        let a = &ctx.accounts.auction;
        require!(a.cleared, MoError::NotCleared);
        let o = &mut ctx.accounts.order;
        require!(!o.settled, MoError::AlreadySettled);
        let mut payout = o.deposit;
        let mut filled = 0u64;
        if o.revealed && a.matched_qty > 0 {
            let eligible_total = if o.side == 0 { a.buy_eligible } else { a.sell_eligible };
            let eligible = (o.side == 0 && o.price >= a.clear_price) || (o.side == 1 && o.price <= a.clear_price);
            if eligible && eligible_total > 0 {
                filled = ((o.qty as u128) * (a.matched_qty as u128) / (eligible_total as u128)) as u64;
                let notional = filled * a.clear_price * LAMPORTS_PER_TICK;
                if o.side == 0 { payout = o.deposit - notional; } else { payout = o.deposit + notional; }
            }
        }
        o.filled = filled;
        o.settled = true;
        if payout > 0 {
            let auction_key = a.key();
            let seeds: &[&[u8]] = &[b"vault", auction_key.as_ref(), &[a.vault_bump]];
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
        Ok(())
    }
}

pub fn commitment_hash(side: u8, price: u64, qty: u64, salt: &[u8; 32], trader: &Pubkey) -> [u8; 32] {
    hashv(&[&[side][..], &price.to_le_bytes(), &qty.to_le_bytes(), salt, trader.as_ref()]).to_bytes()
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
#[instruction(auction_id: u64)]
pub struct CreateAuction<'info> {
    #[account(init, payer = authority, space = 8 + Auction::INIT_SPACE,
        seeds = [b"auction", authority.key().as_ref(), &auction_id.to_le_bytes()], bump)]
    pub auction: Account<'info, Auction>,
    /// CHECK: lamport vault PDA, system-owned
    #[account(mut, seeds = [b"vault", auction.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
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
    pub trader: Signer<'info>,
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
    pub system_program: Program<'info, System>,
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
}
