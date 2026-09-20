use anchor_lang::prelude::*;

declare_id!("BkQ52a3gZ9QA41juyQ7hDdUG5XLocrSUzeeBtq1");

#[program]
pub mod brdc_reserve {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.reserve_state;
        state.admin = ctx.accounts.admin.key();
        state.treasury = ctx.accounts.admin.key();
        state.settlement_asset = ctx.accounts.settlement_asset.key();
        state.basket_oracle = ctx.accounts.oracle.key();
        state.brdc_token = ctx.accounts.token.key();
        state.redemption_request_count = 0;
        Ok(())
    }

    pub fn deposit_treasury(ctx: Context<DepositTreasury>, amount: u64) -> Result<()> {
        let state = &mut ctx.accounts.reserve_state;
        require!(amount > 0, BRDC_RESERVE_ERRORS::ZERO_AMOUNT);
        require!(ctx.accounts.treasury_authority.key() == state.treasury, BRDC_RESERVE_ERRORS::UNAUTHORIZED);

        // Transfer USDC from treasury to reserve
        let cpi_instruction = spl_token::instruction::transfer_checked(
            ctx.accounts.settlement_asset_program.key,
            ctx.accounts.treasury_authority.to_account_info(),
            ctx.accounts.settlement_asset.to_account_info(),
            ctx.accounts.reserve_ata.to_account_info(),
            ctx.accounts.treasury_authority.to_account_info(),
            &[],
            amount,
        )?;

        solana_program::program::invoke(
            &cpi_instruction,
            &[
                ctx.accounts.treasury_authority.to_account_info(),
                ctx.accounts.settlement_asset.to_account_info(),
                ctx.accounts.reserve_ata.to_account_info(),
            ],
        )?;

        state.treasury_balance += amount;
        emit TreasuryDepositedEvent {
            from: ctx.accounts.treasury_authority.key(),
            amount,
        };
        Ok(())
    }

    pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, amount: u64, reason: String) -> Result<()> {
        let state = &mut ctx.accounts.reserve_state;
        require!(amount <= state.treasury_balance, BRDC_RESERVE_ERRORS::INSUFFICIENT_BALANCE);
        require!(ctx.accounts.treasury_authority.key() == state.treasury, BRDC_RESERVE_ERRORS::UNAUTHORIZED);

        let cpi_instruction = spl_token::instruction::transfer_checked(
            ctx.accounts.settlement_asset_program.key,
            ctx.accounts.reserve_ata.to_account_info(),
            ctx.accounts.treasury_authority.to_account_info(),
            ctx.accounts.treasury_authority.to_account_info(),
            &[],
            amount,
        )?;

        solana_program::program::invoke(
            &cpi_instruction,
            &[
                ctx.accounts.reserve_ata.to_account_info(),
                ctx.accounts.treasury_authority.to_account_info(),
            ],
        )?;

        state.treasury_balance -= amount;
        emit TreasuryWithdrawnEvent {
            to: ctx.accounts.treasury_authority.key(),
            amount,
            reason,
        };
        Ok(())
    }

    pub fn register_redemption(ctx: Context<RegisterRedemption>, brdc_amount_burned: u64) -> Result<()> {
        let state = &mut ctx.accounts.reserve_state;
        require!(brdc_amount_burned > 0, BRDC_RESERVE_ERRORS::ZERO_AMOUNT);
        require!(ctx.accounts.settler.key() == state.settler, BRDC_RESERVE_ERRORS::UNAUTHORIZED);

        // NAV virá do oracle externo — simplificado para testnet
        // Na implementação real, o off-chain poster fornece o NAV atual
        // Este exemplo usa um NAV mock de 1.0 USD (8 decimais) = 100000000
        let nav = 100_000_000u64; // 1.0 USD com 8 decimais

        // Conversão: brdcAmountBurned * nav / 1e20
        // brdcAmountBurned em 18 decimais, nav em 8 decimais => total 26 decimais / 1e20 = 6 decimais (USDC)
        let gross_due = (brdc_amount_burned as u128 * nav as u128) / 10_u128.pow(20);
        let fee = (gross_due * REDEMPTION_FEE_BPS as u128) / BPS_DENOMINATOR as u128;
        let net_due = gross_due - fee;

        require!(net_due as u64 <= state.treasury_balance, BRDC_RESERVE_ERRORS::INSUFFICIENT_TREASURY);

        let request_id = state.redemption_request_count;
        state.redemption_request_count += 1;

        ctx.accounts.redemption_request.requester = ctx.accounts.holder.key();
        ctx.accounts.redemption_request.brdc_amount_burned = brdc_amount_burned;
        ctx.accounts.redemption_request.nav_at_request = nav;
        ctx.accounts.redemption_request.settlement_amount_due = net_due as u64;
        ctx.accounts.redemption_request.settled = false;
        ctx.accounts.redemption_request.requested_at = Clock::get().unwrap().unix_timestamp;

        emit RedemptionRequestedEvent {
            request_id,
            requester: ctx.accounts.holder.key(),
            brdc_amount: brdc_amount_burned,
            nav_at_request: nav,
            settlement_due: net_due as u64,
        };
        Ok(())
    }

    pub fn settle_redemption(ctx: Context<SettleRedemption>, request_id: u64) -> Result<()> {
        let state = &mut ctx.accounts.reserve_state;
        let request = &mut ctx.accounts.redemption_request;
        require!(request.settled == false, BRDC_RESERVE_ERRORS::ALREADY_SETTLED);
        require!(ctx.accounts.settler.key() == state.settler, BRDC_RESERVE_ERRORS::UNAUTHORIZED);
        require!(request.settlement_amount_due <= state.treasury_balance, BRDC_RESERVE_ERRORS::INSUFFICIENT_TREASURY);

        // Transfer USDC to requester
        let cpi_instruction = spl_token::instruction::transfer_checked(
            ctx.accounts.settlement_asset_program.key,
            ctx.accounts.reserve_ata.to_account_info(),
            ctx.accounts.requester_ata.to_account_info(),
            ctx.accounts.settler.to_account_info(),
            &[],
            request.settlement_amount_due,
        )?;

        solana_program::program::invoke(
            &cpi_instruction,
            &[
                ctx.accounts.reserve_ata.to_account_info(),
                ctx.accounts.requester_ata.to_account_info(),
            ],
        )?;

        state.treasury_balance -= request.settlement_amount_due;
        request.settled = true;

        emit RedemptionSettledEvent {
            request_id,
            requester: request.requester,
            amount_paid: request.settlement_amount_due,
        };
        Ok(())
    }

    pub fn publish_reserve_snapshot(ctx: Context<PublishReserveSnapshot>, note: String) -> Result<()> {
        let state = &mut ctx.accounts.reserve_state;
        require!(ctx.accounts.treasury_authority.key() == state.treasury, BRDC_RESERVE_ERRORS::UNAUTHORIZED);
        emit ProofOfReserveSnapshotEvent {
            settlement_balance: state.treasury_balance,
            timestamp: Clock::get().unwrap().unix_timestamp,
            note,
        };
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 32 * 4 + 8)]
    pub reserve_state: Account<'info, ReserveState>,
    pub admin: Signer<'info>,
    pub settlement_asset: Account<'info, SPLToken>,
    pub oracle: Account<'info, OracleState>,
    pub token: Account<'info, TokenState>,
    #[account(mut)]
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositTreasury<'info> {
    #[account(mut)]
    pub reserve_state: Account<'info, ReserveState>,
    pub treasury_authority: Signer<'info>,
    pub settlement_asset_program: Account<'info, SPLTokenProgram>,
    pub settlement_asset: Account<'info, SPLToken>,
    #[account(mut)]
    pub reserve_ata: Account<'info, SPLTokenAccount>,
}

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    #[account(mut)]
    pub reserve_state: Account<'info, ReserveState>,
    pub treasury_authority: Signer<'info>,
    pub settlement_asset_program: Account<'info, SPLTokenProgram>,
    #[account(mut)]
    pub reserve_ata: Account<'info, SPLTokenAccount>,
}

#[derive(Accounts)]
pub struct RegisterRedemption<'info> {
    #[account(mut)]
    pub reserve_state: Account<'info, ReserveState>,
    #[account(mut)]
    pub holder: Account<'info, Holder>,
    #[account(init, payer = holder, space = 8 + 32 + 8 + 8 + 8 + 1 + 8)]
    pub redemption_request: Account<'info, RedemptionRequest>,
    pub settler: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleRedemption<'info> {
    #[account(mut)]
    pub reserve_state: Account<'info, ReserveState>,
    #[account(mut)]
    pub redemption_request: Account<'info, RedemptionRequest>,
    #[account(mut)]
    pub reserve_ata: Account<'info, SPLTokenAccount>,
    #[account(mut)]
    pub requester_ata: Account<'info, SPLTokenAccount>,
    pub settler: Signer<'info>,
    pub settlement_asset_program: Account<'info, SPLTokenProgram>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PublishReserveSnapshot<'info> {
    #[account(mut)]
    pub reserve_state: Account<'info, ReserveState>,
    pub treasury_authority: Signer<'info>,
}

#[account]
pub struct ReserveState {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub settler: Pubkey,
    pub settlement_asset: Pubkey,
    pub basket_oracle: Pubkey,
    pub brdc_token: Pubkey,
    pub redemption_request_count: u64,
    pub treasury_balance: u64,
}

#[account]
pub struct RedemptionRequest {
    pub requester: Pubkey,
    pub brdc_amount_burned: u64,
    pub nav_at_request: u64,
    pub settlement_amount_due: u64,
    pub settled: bool,
    pub requested_at: i64,
}

#[account]
pub struct Holder {
    pub balance: u64,
    pub kyc_tier: u8,
    pub is_blacklisted: bool,
}

#[account]
pub struct OracleState {
    pub admin: Pubkey,
}

#[account]
pub struct TokenState {
    pub admin: Pubkey,
}

#[account]
pub struct SPLToken {}

#[account]
pub struct SPLTokenProgram {}

#[account]
pub struct SPLTokenAccount {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

#[error]
pub enum BRDC_RESERVE_ERRORS {
    ZERO_AMOUNT,
    UNAUTHORIZED,
    INSUFFICIENT_BALANCE,
    INSUFFICIENT_TREASURY,
    ALREADY_SETTLED,
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
    pub reason: String,
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
pub struct ProofOfReserveSnapshotEvent {
    pub settlement_balance: u64,
    pub timestamp: i64,
    pub note: String,
}

const REDEMPTION_FEE_BPS: u64 = 30;
const BPS_DENOMINATOR: u64 = 10000;
