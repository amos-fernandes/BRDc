use anchor_lang::prelude::*;

declare_id!("BrQc4GvMp3gZ9QA41juyQ7hDdUG5XLocrSUzeeBtq1");

#[program]
pub mod brdc_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.token_state;
        state.admin = ctx.accounts.admin.key();
        state.pauser = ctx.accounts.admin.key();
        state.basket_oracle = ctx.accounts.oracle.key();
        state.total_supply = 0;
        state.total_gold_reserves_grams = 0;
        state.gold_backed_supply = 0;
        state.redemption_request_count = 0;
        state.is_paused = false;
        state.active_bar_serials_len = 0;
        Ok(())
    }

    pub fn mint(ctx: Context<Mint>, amount: u64, gold_backed: bool) -> Result<()> {
        let state = &mut ctx.accounts.token_state;
        require!(!state.is_paused, BRDC_ERRORS::PAUSED);
        require!(amount > 0, BRDC_ERRORS::ZERO_AMOUNT);

        if gold_backed {
            require!(
                state.gold_backed_supply + amount as u64 <= state.total_gold_reserves_grams,
                BRDC_ERRORS::EXCEEDS_GOLD_BACKED
            );
            state.gold_backed_supply += amount as u64;
        }

        // NAV vai vir do oracle externo — o mint não calcula aqui
        // O off-chain poster deve validar o NAV antes de autorizar o mint
        // (implementação simplificada para testnet)

        state.total_supply += amount as u64;
        emit MintEvent {
            to: ctx.accounts.recipient.key(),
            amount,
            gold_backed,
        };
        Ok(())
    }

    pub fn burn(ctx: Context<Burn>, amount: u64) -> Result<()> {
        let state = &mut ctx.accounts.token_state;
        require!(amount > 0, BRDC_ERRORS::ZERO_AMOUNT);
        require!(amount <= ctx.accounts.holder.balance, BRDC_ERRORS::INSUFFICIENT_BALANCE);

        if state.gold_backed_supply > 0 {
            let reduction = std::cmp::min(amount as u64, state.gold_backed_supply);
            state.gold_backed_supply -= reduction;
        }

        ctx.accounts.holder.balance -= amount as u64;
        state.total_supply -= amount as u64;

        emit BurnEvent {
            from: ctx.accounts.holder.key(),
            amount,
        };
        Ok(())
    }

    pub fn request_gold_redemption(
        ctx: Context<RequestGoldRedemption>,
        amount_grams: u64,
        delivery_address: String,
    ) -> Result<()> {
        let state = &mut ctx.accounts.token_state;
        require!(!state.is_paused, BRDC_ERRORS::PAUSED);
        require!(amount_grams >= MIN_GOLD_REDEMPTION_GRAMS, BRDC_ERRORS::BELOW_MINIMUM);
        require!(
            amount_grams <= ctx.accounts.holder.balance,
            BRDC_ERRORS::INSUFFICIENT_BALANCE
        );
        require!(
            state.gold_backed_supply >= amount_grams,
            BRDC_ERRORS::INSUFFICIENT_GOLD_BACKED
        );
        require!(
            state.total_gold_reserves_grams >= amount_grams,
            BRDC_ERRORS::INSUFFICIENT_GOLD_RESERVES
        );
        require!(!delivery_address.is_empty(), BRDC_ERRORS::INVALID_ADDRESS);

        let fee = (amount_grams as u128 * REDEMPTION_FEE_BPS) / BPS_DENOMINATOR as u128;
        let net_amount = amount_grams as u128 - fee;

        ctx.accounts.holder.balance -= amount_grams as u64;
        state.gold_backed_supply -= amount_grams as u64;
        state.total_gold_reserves_grams -= amount_grams as u64;

        let request_id = state.redemption_request_count;
        state.redemption_request_count += 1;

        ctx.accounts.redemption_request.requester = ctx.accounts.holder.key();
        ctx.accounts.redemption_request.amount_grams = net_amount as u64;
        ctx.accounts.redemption_request.requested_at = Clock::get().unwrap().unix_timestamp;
        ctx.accounts.redemption_request.processsed = false;
        ctx.accounts.redemption_request.delivery_address = delivery_address;
        ctx.accounts.redemption_request.fee_paid = fee as u64;

        emit GoldRedemptionRequestedEvent {
            request_id,
            requester: ctx.accounts.holder.key(),
            amount_grams: amount_grams as u64,
        };
        Ok(())
    }

    pub fn process_gold_redemption(ctx: Context<ProcessGoldRedemption>, request_id: u64) -> Result<()> {
        let state = &mut ctx.accounts.token_state;
        let request = &mut ctx.accounts.redemption_request;
        require!(request.processsed == false, BRDC_ERRORS::ALREADY_PROCESSED);
        require!(request.requester == ctx.accounts.custodian.key(), BRDC_ERRORS::UNAUTHORIZED);
        request.processsed = true;

        emit GoldRedemptionProcessedEvent {
            request_id,
            requester: request.requester,
            amount_grams: request.amount_grams,
            fee_paid: request.fee_paid,
        };
        Ok(())
    }

    pub fn deposit_gold(
        ctx: Context<DepositGold>,
        bar_serial_number: [u8; 32],
        weight_grams: u64,
        purity: u64,
        vault_location: String,
    ) -> Result<()> {
        let state = &mut ctx.accounts.token_state;
        require!(weight_grams > 0, BRDC_ERRORS::INVALID_WEIGHT);
        require!(purity >= 9900 && purity <= 9999, BRDC_ERRORS::INVALID_PURITY);

        let record = &mut ctx.accounts.custody_record;
        record.bar_serial_number = bar_serial_number;
        record.weight_grams = weight_grams as u64;
        record.purity = purity;
        record.vault_location = vault_location;
        record.deposited_at = Clock::get().unwrap().unix_timestamp;
        record.is_active = true;

        state.total_gold_reserves_grams += weight_grams as u64;
        state.active_bar_serials_len += 1;

        emit GoldDepositedEvent {
            bar_serial: bar_serial_number,
            weight_grams,
            vault_location,
        };
        Ok(())
    }

    pub fn withdraw_gold(
        ctx: Context<WithdrawGold>,
        bar_serial_number: [u8; 32],
        reason: String,
    ) -> Result<()> {
        let state = &mut ctx.accounts.token_state;
        let record = &mut ctx.accounts.custody_record;
        require!(record.is_active, BRDC_ERRORS::BAR_NOT_ACTIVE);

        let weight = record.weight_grams;
        record.is_active = false;
        record.weight_grams = 0;
        state.total_gold_reserves_grams -= weight as u64;
        state.active_bar_serials_len -= 1;

        emit GoldWithdrawnEvent {
            bar_serial: bar_serial_number,
            weight_grams: weight,
            reason,
        };
        Ok(())
    }

    pub fn set_kyc_tier(ctx: Context<SetKycTier>, tier: u8) -> Result<()> {
        require!(tier <= 3, BRDC_ERRORS::INVALID_TIER);
        ctx.accounts.holder.kyc_tier = tier;
        emit KycUpdatedEvent {
            account: ctx.accounts.holder.key(),
            tier,
        };
        Ok(())
    }

    pub fn set_blacklist(ctx: Context<SetBlacklist>, is_blacklisted: bool) -> Result<()> {
        ctx.accounts.holder.is_blacklisted = is_blacklisted;
        emit BlacklistUpdatedEvent {
            account: ctx.accounts.holder.key(),
            status: is_blacklisted,
        };
        Ok(())
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        let state = &mut ctx.accounts.token_state;
        require!(state.pauser == ctx.accounts.custodian.key(), BRDC_ERRORS::UNAUTHORIZED);
        state.is_paused = true;
        emit EmergencyShutdownEvent {
            reason: "emergency pause".to_string(),
        };
        Ok(())
    }

    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        let state = &mut ctx.accounts.token_state;
        require!(state.pauser == ctx.accounts.custodian.key(), BRDC_ERRORS::UNAUTHORIZED);
        state.is_paused = false;
        Ok(())
    }

    pub fn set_basket_oracle(ctx: Context<SetBasketOracle>, oracle_key: Pubkey) -> Result<()> {
        require!(oracle_key != Pubkey::default(), BRDC_ERRORS::INVALID_ORACLE);
        ctx.accounts.token_state.basket_oracle = oracle_key;
        emit BasketOracleUpdatedEvent {
            old_oracle: Pubkey::default(),
            new_oracle: oracle_key,
        };
        Ok(())
    }

    pub fn get_nav(ctx: Context<GetNav>) -> Result<()> {
        // O NAV é obtido do oracle externo via off-chain poster
        // Este endpoint apenas emite o evento para o off-chain listener
        emit NavRequestedEvent {
            requester: ctx.accounts.token_state.admin,
        };
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 32 * 7 + 8 + 8 + 8 + 8 + 8 + 1)]
    pub token_state: Account<'info, TokenState>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Mint<'info> {
    #[account(mut)]
    pub token_state: Account<'info, TokenState>,
    #[account(mut)]
    pub holder: Account<'info, Holder>,
    pub recipient: Signer<'info>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct Burn<'info> {
    #[account(mut)]
    pub token_state: Account<'info, TokenState>,
    #[account(mut)]
    pub holder: Account<'info, Holder>,
}

#[derive(Accounts)]
pub struct RequestGoldRedemption<'info> {
    #[account(mut)]
    pub token_state: Account<'info, TokenState>,
    #[account(mut)]
    pub holder: Account<'info, Holder>,
    #[account(init, payer = holder, space = 8 + 32 + 8 + 8 + 1 + 4 + 8)]
    pub redemption_request: Account<'info, GoldRedemptionRequest>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessGoldRedemption<'info> {
    #[account(mut)]
    pub token_state: Account<'info, TokenState>,
    #[account(mut)]
    pub redemption_request: Account<'info, GoldRedemptionRequest>,
    pub custodian: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositGold<'info> {
    #[account(mut)]
    pub token_state: Account<'info, TokenState>,
    #[account(init, payer = custodian, space = 8 + 32 + 8 + 8 + 4 + 8 + 1)]
    pub custody_record: Account<'info, CustodyRecord>,
    pub custodian: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawGold<'info> {
    #[account(mut)]
    pub token_state: Account<'info, TokenState>,
    #[account(mut)]
    pub custody_record: Account<'info, CustodyRecord>,
    pub custodian: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetKycTier<'info> {
    #[account(mut)]
    pub holder: Account<'info, Holder>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetBlacklist<'info> {
    #[account(mut)]
    pub holder: Account<'info, Holder>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(mut)]
    pub token_state: Account<'info, TokenState>,
    pub custodian: Signer<'info>,
}

#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(mut)]
    pub token_state: Account<'info, TokenState>,
    pub custodian: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetBasketOracle<'info> {
    #[account(mut)]
    pub token_state: Account<'info, TokenState>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetNav<'info> {
    pub token_state: Account<'info, TokenState>,
}

#[account]
pub struct TokenState {
    pub admin: Pubkey,
    pub pauser: Pubkey,
    pub basket_oracle: Pubkey,
    pub total_supply: u64,
    pub total_gold_reserves_grams: u64,
    pub gold_backed_supply: u64,
    pub redemption_request_count: u64,
    pub is_paused: bool,
    pub active_bar_serials_len: u64,
}

#[account]
pub struct Holder {
    pub balance: u64,
    pub kyc_tier: u8,
    pub is_blacklisted: bool,
    pub daily_volume: u64,
    pub last_volume_reset: i64,
}

#[account]
pub struct GoldRedemptionRequest {
    pub requester: Pubkey,
    pub amount_grams: u64,
    pub requested_at: i64,
    pub processed: bool,
    pub delivery_address: String,
    pub fee_paid: u64,
}

#[account]
pub struct CustodyRecord {
    pub bar_serial_number: [u8; 32],
    pub weight_grams: u64,
    pub purity: u64,
    pub vault_location: String,
    pub deposited_at: i64,
    pub is_active: bool,
}

#[error]
pub enum BRDC_ERRORS {
    PAUSED,
    ZERO_AMOUNT,
    EXCEEDS_GOLD_BACKED,
    INSUFFICIENT_BALANCE,
    INSUFFICIENT_GOLD_BACKED,
    INSUFFICIENT_GOLD_RESERVES,
    BELOW_MINIMUM,
    INVALID_ADDRESS,
    ALREADY_PROCESSED,
    UNAUTHORIZED,
    INVALID_WEIGHT,
    INVALID_PURITY,
    INVALID_TIER,
    BAR_NOT_ACTIVE,
    INVALID_ORACLE,
    KYC_REQUIRED,
    DAILY_LIMIT_EXCEEDED,
    STALE_PRICE,
}

#[event]
pub struct MintEvent {
    pub to: Pubkey,
    pub amount: u64,
    pub gold_backed: bool,
}

#[event]
pub struct BurnEvent {
    pub from: Pubkey,
    pub amount: u64,
}

#[event]
pub struct GoldRedemptionRequestedEvent {
    pub request_id: u64,
    pub requester: Pubkey,
    pub amount_grams: u64,
}

#[event]
pub struct GoldRedemptionProcessedEvent {
    pub request_id: u64,
    pub requester: Pubkey,
    pub amount_grams: u64,
    pub fee_paid: u64,
}

#[event]
pub struct GoldDepositedEvent {
    pub bar_serial: [u8; 32],
    pub weight_grams: u64,
    pub vault_location: String,
}

#[event]
pub struct GoldWithdrawnEvent {
    pub bar_serial: [u8; 32],
    pub weight_grams: u64,
    pub reason: String,
}

#[event]
pub struct KycUpdatedEvent {
    pub account: Pubkey,
    pub tier: u8,
}

#[event]
pub struct BlacklistUpdatedEvent {
    pub account: Pubkey,
    pub status: bool,
}

#[event]
pub struct EmergencyShutdownEvent {
    pub reason: String,
}

#[event]
pub struct BasketOracleUpdatedEvent {
    pub old_oracle: Pubkey,
    pub new_oracle: Pubkey,
}

#[event]
pub struct NavRequestedEvent {
    pub requester: Pubkey,
}

const MIN_GOLD_REDEMPTION_GRAMS: u64 = 100 * 10_u64.pow(18) as u64; // 100 grams scaled
const REDEMPTION_FEE_BPS: u64 = 50;
const BPS_DENOMINATOR: u64 = 10000;

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::solana_program::{instruction::Instruction, native_token::LAMPORTS_PER_SOL};

    // Mock tests placeholder — real tests need test harness
    #[test]
    fn test_constants() {
        assert_eq!(MIN_GOLD_REDEMPTION_GRAMS, 100 * 10_u64.pow(18) as u64);
        assert_eq!(REDEMPTION_FEE_BPS, 50);
        assert_eq!(BPS_DENOMINATOR, 10000);
    }
}
