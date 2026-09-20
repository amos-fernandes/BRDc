use anchor_lang::prelude::*;

declare_id!("73XxXyvGVtG73itS4h1oo9gXqyzityCb7hzyrWeGL9tD");

#[program]
pub mod brdc_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts
            .token_state
            .initialize(ctx.accounts.admin.key(), ctx.accounts.token_mint.key());
        emit!(TokenInitializedEvent {
            admin: ctx.accounts.admin.key(),
            token_mint: ctx.accounts.token_mint.key(),
        });
        Ok(())
    }

    pub fn mint(
        ctx: Context<MintContext>,
        recipient: Pubkey,
        amount: u64,
        gold_backed: bool,
    ) -> Result<()> {
        ctx.accounts.token_state.mint_to(
            ctx.accounts.admin.key(),
            &mut ctx.accounts.holder,
            recipient,
            amount,
            gold_backed,
        );
        Ok(())
    }

    pub fn burn(ctx: Context<BurnContext>, amount: u64) -> Result<()> {
        ctx.accounts.token_state.burn_from(
            ctx.accounts.admin.key(),
            &mut ctx.accounts.holder,
            amount,
        );
        Ok(())
    }

    pub fn request_gold_redemption(
        ctx: Context<RedemptionContext>,
        amount_grams: u64,
        delivery_address: String,
    ) -> Result<()> {
        ctx.accounts.token_state.request_gold_redemption(
            ctx.accounts.admin.key(),
            &mut ctx.accounts.holder,
            amount_grams,
            delivery_address,
            &ctx.accounts.nav_state,
            &mut ctx.accounts.redeem_req,
        );
        Ok(())
    }

    pub fn process_gold_redemption(
        ctx: Context<ProcessRedemptionContext>,
        request_id: u64,
    ) -> Result<()> {
        ctx.accounts.redeem_req.process(
            ctx.accounts.admin.key(),
            request_id,
        );
        Ok(())
    }

    pub fn register_gold_custody(
        ctx: Context<RegisterGoldContext>,
        bar_serial: [u8; 32],
        weight_grams: u64,
        purity: u64,
        vault_location: String,
    ) -> Result<()> {
        ctx.accounts.token_state.register_gold(
            ctx.accounts.admin.key(),
            bar_serial,
            weight_grams,
            purity,
            vault_location,
        );
        Ok(())
    }

    pub fn withdraw_gold(
        ctx: Context<WithdrawGoldContext>,
        bar_serial: [u8; 32],
        reason: String,
    ) -> Result<()> {
        ctx.accounts.token_state.withdraw_gold(
            ctx.accounts.admin.key(),
            bar_serial,
            reason,
        );
        Ok(())
    }

    pub fn set_kyc(ctx: Context<SetKycContext>, kyc_tier: u8) -> Result<()> {
        ctx.accounts.holder.set_kyc(
            ctx.accounts.admin.key(),
            kyc_tier,
        );
        Ok(())
    }

    pub fn set_blacklist(
        ctx: Context<SetBlacklistContext>,
        blacklisted: bool,
    ) -> Result<()> {
        ctx.accounts.holder.set_blacklist(
            ctx.accounts.admin.key(),
            blacklisted,
        );
        Ok(())
    }

    pub fn pause(ctx: Context<PauseContext>) -> Result<()> {
        ctx.accounts.token_state.pause(ctx.accounts.admin.key());
        Ok(())
    }

    pub fn unpause(ctx: Context<UnpauseContext>) -> Result<()> {
        ctx.accounts.token_state.unpause(ctx.accounts.admin.key());
        Ok(())
    }

    pub fn get_nav(ctx: Context<GetNavContext>) -> Result<()> {
        ctx.accounts.nav_state.emit_nav(ctx.accounts.holder.key());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    pub payer: AccountInfo<'info>,
    pub token_mint: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintContext<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub holder: Account<'info, HolderAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnContext<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub holder: Account<'info, HolderAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RedemptionContext<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub holder: Account<'info, HolderAccount>,
    #[account(seeds = [b"nav_bridge"], bump)]
    pub nav_state: Account<'info, NavState>,
    #[account(mut)]
    pub redeem_req: Account<'info, RedeemRequest>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessRedemptionContext<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub redeem_req: Account<'info, RedeemRequest>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterGoldContext<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    pub custodian: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawGoldContext<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    pub custodian: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetKycContext<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub holder: Account<'info, HolderAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetBlacklistContext<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub holder: Account<'info, HolderAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PauseContext<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnpauseContext<'info> {
    #[account(seeds = [b"token_state"], bump)]
    pub token_state: Account<'info, TokenState>,
    pub admin: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetNavContext<'info> {
    #[account(seeds = [b"nav_bridge"], bump)]
    pub nav_state: Account<'info, NavState>,
    pub holder: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct TokenState {
    pub admin: Pubkey,
    pub total_supply: u64,
    pub gold_reserves: u64,
    pub gold_backed_supply: u64,
    pub paused: bool,
    pub min_gold_redemption: u64,
    pub redemption_fee_bps: u16,
    pub kyc_level: u8,
    pub blacklist_count: u8,
    pub bump: u8,
}

impl TokenState {
    pub fn initialize(&mut self, admin: Pubkey, token_mint: Pubkey) {
        self.admin = admin;
        self.total_supply = 0;
        self.gold_reserves = 0;
        self.gold_backed_supply = 0;
        self.paused = false;
        self.min_gold_redemption = 10_000_000_000;
        self.redemption_fee_bps = 30;
        self.kyc_level = 0;
        self.blacklist_count = 0;
        self.bump = 0;
    }

    pub fn mint_to(
        &mut self,
        admin: Pubkey,
        holder: &mut HolderAccount,
        recipient: Pubkey,
        amount: u64,
        gold_backed: bool,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if self.paused {
            return err!(2);
        }
        if amount == 0 {
            return err!(3);
        }

        if gold_backed {
            let new_backed = match self.gold_backed_supply.checked_add(amount) {
                Some(v) => v,
                None => return err!(4),
            };
            if new_backed > self.gold_reserves {
                return err!(5);
            }
            self.gold_backed_supply = new_backed;
        }

        holder.balance = match holder.balance.checked_add(amount) {
            Some(v) => v,
            None => return err!(4),
        };
        holder.daily_volume = match holder.daily_volume.checked_add(amount) {
            Some(v) => v,
            None => return err!(4),
        };
        self.total_supply = match self.total_supply.checked_add(amount) {
            Some(v) => v,
            None => return err!(4),
        };

        emit!(TokensMintedEvent {
            to: recipient,
            amount,
            gold_backed,
        });
        Ok(())
    }

    pub fn burn_from(
        &mut self,
        admin: Pubkey,
        holder: &mut HolderAccount,
        amount: u64,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if amount == 0 {
            return err!(3);
        }
        if holder.balance < amount {
            return err!(6);
        }

        let reduce = if self.gold_backed_supply > 0 {
            amount.min(self.gold_backed_supply)
        } else {
            0
        };
        self.gold_backed_supply -= reduce;
        holder.balance -= amount;
        holder.daily_volume = match holder.daily_volume.checked_add(amount) {
            Some(v) => v,
            None => return err!(4),
        };
        self.total_supply -= amount;

        emit!(TokensBurnedEvent {
            from: holder.key(),
            amount,
        });
        Ok(())
    }

    pub fn request_gold_redemption(
        &mut self,
        admin: Pubkey,
        holder: &mut HolderAccount,
        amount_grams: u64,
        delivery_address: String,
        nav_state: &NavState,
        redeem_req: &mut RedeemRequest,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if amount_grams < self.min_gold_redemption {
            return err!(7);
        }
        if delivery_address.is_empty() {
            return err!(8);
        }
        if holder.balance < amount_grams {
            return err!(6);
        }
        if self.gold_backed_supply < amount_grams {
            return err!(9);
        }
        if self.gold_reserves < amount_grams {
            return err!(5);
        }
        if nav_state.last_nav == 0 {
            return err!(10);
        }

        let nav = nav_state.last_nav;
        let fee = (amount_grams as u128
            * self.redemption_fee_bps as u128
            * nav)
            / 100_000_000_000u128;
        let usd_due = (amount_grams as u128 * nav) / 10_000_000_000u128;

        redeem_req.request_id += 1;
        let id = redeem_req.request_id;
        redeem_req.amount_grams = amount_grams;
        redeem_req.net_amount = usd_due as u64;
        redeem_req.fee_paid = fee as u64;
        redeem_req.requester = holder.key();
        redeem_req.processed = false;

        holder.balance -= amount_grams;
        self.gold_backed_supply -= amount_grams;
        self.total_supply -= amount_grams;

        emit!(RedemptionRequestedEvent {
            request_id: id,
            requester: holder.key(),
            amount_grams,
            net_amount: usd_due as u64,
            fee_paid: fee as u64,
        });
        Ok(())
    }

    pub fn register_gold(
        &mut self,
        admin: Pubkey,
        bar_serial: [u8; 32],
        weight_grams: u64,
        purity: u64,
        vault_location: String,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if weight_grams == 0 {
            return err!(11);
        }
        if purity < 9900 || purity > 9999 {
            return err!(12);
        }
        if vault_location.is_empty() {
            return err!(13);
        }

        self.gold_reserves = match self.gold_reserves.checked_add(weight_grams) {
            Some(v) => v,
            None => return err!(4),
        };

        emit!(GoldDepositedEvent {
            bar_serial,
            weight_grams,
            purity,
            vault_location: vault_location.into_bytes(),
            deposited_by: admin,
        });
        Ok(())
    }

    pub fn withdraw_gold(
        &mut self,
        admin: Pubkey,
        bar_serial: [u8; 32],
        reason: String,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if reason.is_empty() {
            return err!(14);
        }

        self.gold_reserves = self.gold_reserves.saturating_sub(1000);

        emit!(GoldWithdrawnEvent {
            bar_serial,
            reason: reason.into_bytes(),
            withdrawn_by: admin,
        });
        Ok(())
    }

    pub fn pause(&mut self, admin: Pubkey) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        self.paused = true;
        emit!(EmergencyEvent {
            reason: b"P".to_vec(),
            paused_by: admin,
        });
        Ok(())
    }

    pub fn unpause(&mut self, admin: Pubkey) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        self.paused = false;
        emit!(EmergencyEvent {
            reason: b"UP".to_vec(),
            paused_by: admin,
        });
        Ok(())
    }
}

#[account]
pub struct HolderAccount {
    pub balance: u64,
    pub kyc_tier: u8,
    pub blacklisted: bool,
    pub daily_volume: u64,
    pub bump: u8,
}

impl HolderAccount {
    pub fn set_kyc(&mut self, admin: Pubkey, kyc_tier: u8) -> Result<()> {
        if kyc_tier > 3 {
            return err!(15);
        }
        self.kyc_tier = kyc_tier;
        emit!(KycUpdatedEvent {
            holder: self.key(),
            kyc_tier,
            set_by: admin,
        });
        Ok(())
    }

    pub fn set_blacklist(
        &mut self,
        admin: Pubkey,
        blacklisted: bool,
    ) -> Result<()> {
        self.blacklisted = blacklisted;
        emit!(BlacklistUpdatedEvent {
            holder: self.key(),
            blacklisted,
            set_by: admin,
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

impl NavState {
    pub fn emit_nav(&self, fetched_by: Pubkey) -> Result<()> {
        if self.last_nav == 0 {
            return err!(10);
        }
        emit!(NavRetrievedEvent {
            nav: self.last_nav,
            timestamp: self.last_update_timestamp,
            fetched_by,
        });
        Ok(())
    }
}

#[account]
pub struct RedeemRequest {
    pub request_id: u64,
    pub amount_grams: u64,
    pub net_amount: u64,
    pub fee_paid: u64,
    pub requester: Pubkey,
    pub processed: bool,
}

impl RedeemRequest {
    pub fn process(&mut self, admin: Pubkey, request_id: u64) -> Result<()> {
        if self.processed {
            return err!(16);
        }
        if self.request_id != request_id {
            return err!(17);
        }
        self.processed = true;
        emit!(RedemptionProcessedEvent {
            request_id,
            requester: self.requester,
            amount_grams: self.amount_grams,
            fee_paid: self.fee_paid,
        });
        Ok(())
    }
}

#[event]
pub struct TokenInitializedEvent {
    pub admin: Pubkey,
    pub token_mint: Pubkey,
}

#[event]
pub struct TokensMintedEvent {
    pub to: Pubkey,
    pub amount: u64,
    pub gold_backed: bool,
}

#[event]
pub struct TokensBurnedEvent {
    pub from: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RedemptionRequestedEvent {
    pub request_id: u64,
    pub requester: Pubkey,
    pub amount_grams: u64,
    pub net_amount: u64,
    pub fee_paid: u64,
}

#[event]
pub struct RedemptionProcessedEvent {
    pub request_id: u64,
    pub requester: Pubkey,
    pub amount_grams: u64,
    pub fee_paid: u64,
}

#[event]
pub struct GoldDepositedEvent {
    pub bar_serial: [u8; 32],
    pub weight_grams: u64,
    pub purity: u64,
    pub vault_location: Vec<u8>,
    pub deposited_by: Pubkey,
}

#[event]
pub struct GoldWithdrawnEvent {
    pub bar_serial: [u8; 32],
    pub reason: Vec<u8>,
    pub withdrawn_by: Pubkey,
}

#[event]
pub struct KycUpdatedEvent {
    pub holder: Pubkey,
    pub kyc_tier: u8,
    pub set_by: Pubkey,
}

#[event]
pub struct BlacklistUpdatedEvent {
    pub holder: Pubkey,
    pub blacklisted: bool,
    pub set_by: Pubkey,
}

#[event]
pub struct EmergencyEvent {
    pub reason: Vec<u8>,
    pub paused_by: Pubkey,
}

#[event]
pub struct NavRetrievedEvent {
    pub nav: u64,
    pub timestamp: i64,
    pub fetched_by: Pubkey,
}
