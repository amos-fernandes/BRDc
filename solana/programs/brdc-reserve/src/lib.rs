use anchor_lang::prelude::*;

declare_id!("62KkKywGVtG73itS4h1oo9gXqyzityCb7hzyrWeGL9tD");

#[program]
pub mod brdc_reserve {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.reserve_state.initialize(
            ctx.accounts.admin.key(),
            ctx.accounts.treasury_mint.key(),
        );
        emit!(ReserveInitializedEvent {
            admin: ctx.accounts.admin.key(),
            treasury_mint: ctx.accounts.treasury_mint.key(),
        });
        Ok(())
    }

    pub fn deposit_treasury(
        ctx: Context<DepositTreas>,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.reserve_state.deposit_treasury(
            ctx.accounts.admin.key(),
            amount,
        );
        emit!(TreasuryDepositedEvent {
            from: ctx.accounts.admin.key(),
            amount,
        });
        Ok(())
    }

    pub fn withdraw_treasury(
        ctx: Context<WithdrawTreas>,
        amount: u64,
        reason: String,
    ) -> Result<()> {
        ctx.accounts.reserve_state.withdraw_treasury(
            ctx.accounts.admin.key(),
            amount,
            reason,
        );
        emit!(TreasuryWithdrawnEvent {
            to: ctx.accounts.admin.key(),
            amount,
            reason: reason.into_bytes(),
        });
        Ok(())
    }

    pub fn register_redemption(
        ctx: Context<RegisterRedeem>,
        brdc_amount_burned: u64,
    ) -> Result<()> {
        ctx.accounts.reserve_state.register_redemption(
            ctx.accounts.settler.key(),
            brdc_amount_burned,
            &ctx.accounts.nav_state,
            &mut ctx.accounts.redeem_req,
            ctx.accounts.holder.key(),
        );
        Ok(())
    }

    pub fn settle_redemption(
        ctx: Context<SettleRedeem>,
        request_id: u64,
    ) -> Result<()> {
        ctx.accounts.reserve_state.settle_redemption(
            ctx.accounts.settler.key(),
            &mut ctx.accounts.redeem_req,
        );
        emit!(RedemptionSettledEvent {
            request_id,
            requester: ctx.accounts.redeem_req.requester,
            amount_paid: ctx.accounts.redeem_req.settlement_due,
        });
        Ok(())
    }

    pub fn publish_reserve_snapshot(
        ctx: Context<PublishSnapshot>,
        note: String,
    ) -> Result<()> {
        ctx.accounts.reserve_state.publish_snapshot(
            ctx.accounts.admin.key(),
            note,
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(seeds = [b"reserve_state"], bump)]
    pub reserve_state: Account<'info, ReserveState>,
    pub admin: AccountInfo<'info>,
    pub treasury_mint: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositTreas<'info> {
    #[account(seeds = [b"reserve_state"], bump)]
    pub reserve_state: Account<'info, ReserveState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub reserve_ata: AccountInfo<'info>,
    pub treasury_mint: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawTreas<'info> {
    #[account(seeds = [b"reserve_state"], bump)]
    pub reserve_state: Account<'info, ReserveState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub reserve_ata: AccountInfo<'info>,
    pub treasury_mint: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterRedeem<'info> {
    #[account(seeds = [b"reserve_state"], bump)]
    pub reserve_state: Account<'info, ReserveState>,
    pub settler: AccountInfo<'info>,
    #[account(seeds = [b"nav_bridge"], bump)]
    pub nav_state: Account<'info, NavState>,
    #[account(mut)]
    pub holder: AccountInfo<'info>,
    #[account(mut)]
    pub redeem_req: Account<'info, RedeemRequest>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleRedeem<'info> {
    #[account(seeds = [b"reserve_state"], bump)]
    pub reserve_state: Account<'info, ReserveState>,
    pub settler: AccountInfo<'info>,
    #[account(mut)]
    pub redeem_req: Account<'info, RedeemRequest>,
    #[account(mut)]
    pub holder_ata: AccountInfo<'info>,
    #[account(mut)]
    pub reserve_ata: AccountInfo<'info>,
    pub treasury_mint: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PublishSnapshot<'info> {
    #[account(seeds = [b"reserve_state"], bump)]
    pub reserve_state: Account<'info, ReserveState>,
    pub admin: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct ReserveState {
    pub admin: Pubkey,
    pub balance: u64,
    pub settler: Pubkey,
    pub redeem_count: u64,
    pub snapshot_count: u64,
    pub treasury_mint: Pubkey,
    pub treasury_authority: Pubkey,
    pub bump: u8,
}

impl ReserveState {
    pub fn initialize(&mut self, admin: Pubkey, treasury_mint: Pubkey) {
        self.admin = admin;
        self.balance = 0;
        self.settler = admin;
        self.redeem_count = 0;
        self.snapshot_count = 0;
        self.treasury_mint = treasury_mint;
        self.treasury_authority = admin;
        self.bump = 0;
    }

    pub fn deposit_treasury(
        &mut self,
        admin: Pubkey,
        amount: u64,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if amount == 0 {
            return err!(2);
        }
        self.balance = match self.balance.checked_add(amount) {
            Some(v) => v,
            None => return err!(3),
        };
        Ok(())
    }

    pub fn withdraw_treasury(
        &mut self,
        admin: Pubkey,
        amount: u64,
        reason: String,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if amount > self.balance {
            return err!(4);
        }
        if reason.is_empty() {
            return err!(5);
        }
        self.balance -= amount;
        Ok(())
    }

    pub fn register_redemption(
        &mut self,
        settler: Pubkey,
        brdc_amount_burned: u64,
        nav_state: &NavState,
        redeem_req: &mut RedeemRequest,
        holder_key: Pubkey,
    ) -> Result<()> {
        if self.settler != settler {
            return err!(1);
        }
        if brdc_amount_burned == 0 {
            return err!(2);
        }
        if nav_state.last_nav == 0 {
            return err!(10);
        }

        let nav = nav_state.last_nav;
        let gross = match (brdc_amount_burned as u128)
            .checked_mul(nav as u128)
            .and_then(|v| v.checked_div(10_000_000_000u128))
        {
            Some(v) => v,
            None => return err!(3),
        };
        let fee = (gross * 30u128) / 10000u128;
        let net = gross - fee;

        if (net as u64) > self.balance {
            return err!(6);
        }

        self.redeem_count += 1;
        let id = self.redeem_count;
        redeem_req.settled = false;
        redeem_req.request_id = id;
        redeem_req.requester = holder_key;
        redeem_req.requested_at = Clock::get().unwrap().unix_timestamp;
        redeem_req.settlement_due = net as u64;
        redeem_req.status = b"pending".to_vec();

        emit!(RedemptionRequestedEvent {
            request_id: id,
            requester: holder_key,
            brdc_amount: brdc_amount_burned,
            nav_at_request: nav,
            settlement_due: net as u64,
        });
        Ok(())
    }

    pub fn settle_redemption(
        &mut self,
        settler: Pubkey,
        redeem_req: &mut RedeemRequest,
    ) -> Result<()> {
        if self.settler != settler {
            return err!(1);
        }
        if redeem_req.settled {
            return err!(7);
        }
        if redeem_req.settlement_due > self.balance {
            return err!(6);
        }

        let amount = redeem_req.settlement_due as u64;
        self.balance -= amount;
        redeem_req.settled = true;
        redeem_req.status = b"settled".to_vec();

        emit!(RedemptionSettledEvent {
            request_id: redeem_req.request_id,
            requester: redeem_req.requester,
            amount_paid: amount,
        });
        Ok(())
    }

    pub fn publish_snapshot(
        &mut self,
        admin: Pubkey,
        note: String,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if note.is_empty() {
            return err!(8);
        }
        self.snapshot_count += 1;
        emit!(ProofOfReserveEvent {
            balance: self.balance,
            timestamp: Clock::get().unwrap().unix_timestamp,
            note: note.into_bytes(),
        });
        Ok(())
    }
}

#[account]
pub struct NavState {
    pub last_nav: u64,
    pub last_update_timestamp: i64,
    pub bump: u8,
}

#[account]
pub struct RedeemRequest {
    pub request_id: u64,
    pub requester: Pubkey,
    pub brdc_amount: u64,
    pub nav_at_request: u64,
    pub settlement_due: u64,
    pub settled: bool,
    pub requested_at: i64,
    pub status: Vec<u8>,
}

#[event]
pub struct ReserveInitializedEvent {
    pub admin: Pubkey,
    pub treasury_mint: Pubkey,
}

#[event]
pub struct TreasuryDepositedEvent {
    pub from: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TreasuryWithdrawnEvent {
    pub to: Pubkey,
    pub amount: u64,
    pub reason: Vec<u8>,
}

#[event]
pub struct RedemptionRequestedEvent {
    pub request_id: u64,
    pub requester: Pubkey,
    pub brdc_amount: u64,
    pub nav_at_request: u64,
    pub settlement_due: u64,
}

#[event]
pub struct RedemptionSettledEvent {
    pub request_id: u64,
    pub requester: Pubkey,
    pub amount_paid: u64,
}

#[event]
pub struct ProofOfReserveEvent {
    pub balance: u64,
    pub timestamp: i64,
    pub note: Vec<u8>,
}
