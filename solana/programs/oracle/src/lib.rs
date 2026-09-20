use anchor_lang::prelude::*;

declare_id!("BnQ58a3gZ9QA41juyQ7hDdUG5XLocrSUzeeBtq1");

#[program]
pub mod brdc_oracle {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        state.admin = ctx.accounts.admin.key();
        state.price_updater = ctx.accounts.admin.key();
        state.basket_manager = ctx.accounts.admin.key();
        state.total_weight_bps = 0;
        state.nav_computed = 0;
        Ok(())
    }

    /// Adiciona um ativo à cesta (composição do oracle)
    pub fn add_asset(
        ctx: Context<AddAsset>,
        symbol: String,
        weight_bps: u64,
        source: u8, // 0 = CHAINLINK, 1 = MANUAL
        chainlink_feed: Pubkey,
    ) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        require!(ctx.accounts.basket_manager.key() == state.basket_manager, BRDC_ORACLE_ERRORS::UNAUTHORIZED);
        require!(weight_bps > 0 && weight_bps <= BASIS_POINTS, BRDC_ORACLE_ERRORS::INVALID_WEIGHT);
        require!(state.total_weight_bps + weight_bps <= BASIS_POINTS, BRDC_ORACLE_ERRORS::EXCEEDS_100PCT);

        let id = hash_symbol(&symbol);

        ctx.accounts.asset.symbol = symbol;
        ctx.accounts.asset.weight_bps = weight_bps;
        ctx.accounts.asset.source = source;
        ctx.accounts.asset.chainlink_feed = chainlink_feed;
        ctx.accounts.asset.manual_price = 0;
        ctx.accounts.asset.last_manual_update = 0;
        ctx.accounts.asset.active = true;

        state.total_weight_bps += weight_bps;

        emit AssetAddedEvent {
            id,
            symbol,
            weight_bps,
            source,
        };
        Ok(())
    }

    /// Atualiza o peso de um ativo
    pub fn update_asset_weight(
        ctx: Context<UpdateAssetWeight>,
        symbol: String,
        new_weight_bps: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        require!(ctx.accounts.basket_manager.key() == state.basket_manager, BRDC_ORACLE_ERRORS::UNAUTHORIZED);

        let id = hash_symbol(&symbol);
        let asset = &mut ctx.accounts.asset;
        require!(asset.active, BRDC_ORACLE_ERRORS::ASSET_NOT_ACTIVE);

        let old_weight = asset.weight_bps;
        require!(state.total_weight_bps - old_weight + new_weight_bps <= BASIS_POINTS, BRDC_ORACLE_ERRORS::EXCEEDS_100PCT);

        asset.weight_bps = new_weight_bps;
        state.total_weight_bps = state.total_weight_bps - old_weight + new_weight_bps;

        emit AssetWeightUpdatedEvent {
            id,
            old_weight_bps: old_weight,
            new_weight_bps,
        };
        Ok(())
    }

    /// Desativa um ativo da cesta
    pub fn deactivate_asset(ctx: Context<DeactivateAsset>, symbol: String) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        require!(ctx.accounts.basket_manager.key() == state.basket_manager, BRDC_ORACLE_ERRORS::UNAUTHORIZED);

        let id = hash_symbol(&symbol);
        let asset = &mut ctx.accounts.asset;
        require!(asset.active, BRDC_ORACLE_ERRORS::ALREADY_INACTIVE);

        state.total_weight_bps -= asset.weight_bps;
        asset.active = false;

        emit AssetDeactivatedEvent {
            id,
        };
        Ok(())
    }

    /// Define preço manual (MANUAL source)
    pub fn set_manual_price(
        ctx: Context<SetManualPrice>,
        symbol: String,
        price: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        require!(ctx.accounts.price_updater.key() == state.price_updater, BRDC_ORACLE_ERRORS::UNAUTHORIZED);

        let id = hash_symbol(&symbol);
        let asset = &mut ctx.accounts.asset;
        require!(asset.active, BRDC_ORACLE_ERRORS::ASSET_NOT_ACTIVE);
        require!(asset.source == 1, BRDC_ORACLE_ERRORS::ASSET_USES_CHAINLINK); // 1 = MANUAL
        require!(price > 0, BRDC_ORACLE_ERRORS::INVALID_PRICE);

        asset.manual_price = price;
        asset.last_manual_update = Clock::get().unwrap().unix_timestamp;

        emit ManualPriceUpdatedEvent {
            id,
            old_price: 0,
            new_price: price,
            timestamp: asset.last_manual_update,
        };
        Ok(())
    }

    /// Obtém preço atual de um ativo
    pub fn get_asset_price(ctx: Context<GetAssetPrice>, symbol: String) -> Result<()> {
        let id = hash_symbol(&symbol);
        let asset = &mut ctx.accounts.asset;
        require!(asset.active, BRDC_ORACLE_ERRORS::ASSET_NOT_ACTIVE);

        let (price, is_stale) = if asset.source == 0 {
            // CHAINLINK — mock: retorna preço fixo para testnet
            // Na versão real, usaria um feed Chainlink via CPI ou off-chain
            (100_000_000u64, false) // 1.0 USD
        } else {
            let is_stale = Clock::get().unwrap().unix_timestamp - asset.last_manual_update > MAX_STALENESS;
            (asset.manual_price, is_stale)
        };

        require!(!is_stale, BRDC_ORACLE_ERRORS::STALE_PRICE);
        require!(price > 0, BRDC_ORACLE_ERRORS::ZERO_PRICE);

        emit GetAssetPriceEvent {
            id,
            price,
            is_stale: false,
        };
        Ok(())
    }

    /// Calcula NAV da cesta
    pub fn compute_nav(ctx: Context<ComputeNav>) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        require!(state.total_weight_bps == BASIS_POINTS, BRDC_ORACLE_ERRORS::WEIGHTS_NOT_100PCT);

        // NAV simplificado: soma ponderada dos preços
        // Na implementação real, iteraria sobre todos os ativos
        // Para testnet, usa preço fixo de 1.0 USD por ativo
        let nav = 100_000_000u64; // 1.0 USD com 8 decimais

        state.nav_computed = nav;
        emit NavComputedEvent {
            nav_per_unit: nav,
            timestamp: Clock::get().unwrap().unix_timestamp,
        };
        Ok(())
    }

    pub fn get_basket_composition(ctx: Context<GetBasketComposition>) -> Result<()> {
        // Retorna composição da cesta para o off-chain poster
        emit GetBasketCompositionEvent {
            admin: ctx.accounts.oracle_state.admin,
        };
        Ok(())
    }
}

fn hash_symbol(symbol: &str) -> [u8; 32] {
    use solana_program::hash::hash;
    hash(symbol.as_bytes()).as_ref().try_into().unwrap()
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 32 + 32 + 32 + 8)]
    pub oracle_state: Account<'info, OracleState>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddAsset<'info> {
    #[account(mut)]
    pub oracle_state: Account<'info, OracleState>,
    #[account(init, payer = admin, space = 8 + 32 + 4 + 8 + 1 + 32 + 8 + 8 + 1)]
    pub asset: Account<'info, Asset>,
    pub admin: Signer<'info>,
    pub basket_manager: Signer<'info>,
    #[account(mut)]
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAssetWeight<'info> {
    #[account(mut)]
    pub oracle_state: Account<'info, OracleState>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
    pub basket_manager: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeactivateAsset<'info> {
    #[account(mut)]
    pub oracle_state: Account<'info, OracleState>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
    pub basket_manager: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetManualPrice<'info> {
    #[account(mut)]
    pub oracle_state: Account<'info, OracleState>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
    pub price_updater: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetAssetPrice<'info> {
    #[account]
    pub oracle_state: Account<'info, OracleState>,
    #[account]
    pub asset: Account<'info, Asset>,
}

#[derive(Accounts)]
pub struct ComputeNav<'info> {
    #[account(mut)]
    pub oracle_state: Account<'info, OracleState>,
}

#[derive(Accounts)]
pub struct GetBasketComposition<'info> {
    #[account]
    pub oracle_state: Account<'info, OracleState>,
}

#[account]
pub struct OracleState {
    pub admin: Pubkey,
    pub price_updater: Pubkey,
    pub basket_manager: Pubkey,
    pub total_weight_bps: u64,
    pub nav_computed: u64,
}

#[account]
pub struct Asset {
    pub id: [u8; 32],
    pub symbol: String,
    pub weight_bps: u64,
    pub source: u8,
    pub chainlink_feed: Pubkey,
    pub manual_price: u64,
    pub last_manual_update: i64,
    pub active: bool,
}

#[error]
pub enum BRDC_ORACLE_ERRORS {
    UNAUTHORIZED,
    INVALID_WEIGHT,
    EXCEEDS_100PCT,
    ASSET_NOT_ACTIVE,
    ALREADY_INACTIVE,
    ASSET_USES_CHAINLINK,
    INVALID_PRICE,
    WEIGHTS_NOT_100PCT,
    STALE_PRICE,
    ZERO_PRICE,
}

#[event]
pub struct AssetAddedEvent {
    pub id: [u8; 32],
    pub symbol: String,
    pub weight_bps: u64,
    pub source: u8,
}

#[event]
pub struct AssetWeightUpdatedEvent {
    pub id: [u8; 32],
    pub old_weight_bps: u64,
    pub new_weight_bps: u64,
}

#[event]
pub struct AssetDeactivatedEvent {
    pub id: [u8; 32],
}

#[event]
pub struct ManualPriceUpdatedEvent {
    pub id: [u8; 32],
    pub old_price: u64,
    pub new_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct GetAssetPriceEvent {
    pub id: [u8; 32],
    pub price: u64,
    pub is_stale: bool,
}

#[event]
pub struct NavComputedEvent {
    pub nav_per_unit: u64,
    pub timestamp: i64,
}

#[event]
pub struct GetBasketCompositionEvent {
    pub admin: Pubkey,
}

const BASIS_POINTS: u64 = 10000;
const MAX_STALENESS: i64 = 6 * 60 * 60; // 6 hours in seconds
const PRICE_PRECISION: u64 = 100_000_000; // 1e8 (8 decimal places)
