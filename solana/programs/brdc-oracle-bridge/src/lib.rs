use anchor_lang::prelude::*;

declare_id!("4YCcQywGVtG73itS4h1oo9gXqyzityCb7hzyrWeGL9tD");

#[program]
pub mod brdc_oracle_bridge {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts
            .bridge_state
            .initialize(ctx.accounts.admin.key());
        emit!(BridgeInitializedEvent {
            admin: ctx.accounts.admin.key(),
        });
        Ok(())
    }

    pub fn update_nav(ctx: Context<UpdateNav>, new_nav: u64) -> Result<()> {
        if ctx.accounts.admin.key() != ctx.accounts.bridge_state.admin {
            return err!(1);
        }
        ctx.accounts
            .bridge_state
            .set_nav(new_nav, Clock::get().unwrap().unix_timestamp);
        emit!(NavUpdatedEvent {
            new_nav,
            updated_at: Clock::get().unwrap().unix_timestamp,
        });
        Ok(())
    }

    pub fn get_nav(ctx: Context<GetNav>) -> Result<()> {
        if ctx.accounts.bridge_state.last_nav == 0 {
            return err!(2);
        }
        emit!(NavRetrievedEvent {
            nav: ctx.accounts.bridge_state.last_nav,
            timestamp: ctx.accounts.bridge_state.last_update_timestamp,
            fetched_by: ctx.accounts.fetching_info.key(),
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(seeds = [b"bridge"], bump)]
    pub bridge_state: Account<'info, BridgeState>,
    pub admin: AccountInfo<'info>,
    pub payer: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateNav<'info> {
    #[account(seeds = [b"bridge"], bump)]
    pub bridge_state: Account<'info, BridgeState>,
    pub admin: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetNav<'info> {
    #[account(seeds = [b"bridge"], bump)]
    pub bridge_state: Account<'info, BridgeState>,
    pub fetching_info: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct BridgeState {
    pub admin: Pubkey,
    pub last_nav: u64,
    pub last_update_timestamp: i64,
    pub authority: Pubkey,
}

impl BridgeState {
    pub fn initialize(&mut self, admin: Pubkey) {
        self.admin = admin;
        self.last_nav = 0;
        self.last_update_timestamp = 0;
        self.authority = admin;
    }

    pub fn set_nav(&mut self, new_nav: u64, timestamp: i64) {
        self.last_nav = new_nav;
        self.last_update_timestamp = timestamp;
    }
}

#[event]
pub struct BridgeInitializedEvent {
    pub admin: Pubkey,
}

#[event]
pub struct NavUpdatedEvent {
    pub new_nav: u64,
    pub updated_at: i64,
}

#[event]
pub struct NavRetrievedEvent {
    pub nav: u64,
    pub timestamp: i64,
    pub fetched_by: Pubkey,
}
