use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};
use bytemuck::{Pod, Zeroable};

entrypoint!(process_instruction);

#[repr(C)]
#[derive(Debug, Default, Copy, Clone, Pod, Zeroable)]
pub struct TokenState {
    pub admin: [u8; 32],
    pub total_supply: u64,
    pub gold_reserves: u64,
    pub gold_backed_supply: u64,
    pub min_gold_redemption: u64,
    pub redemption_fee_bps: u16,
    pub paused: u8,
    pub _padding: [u8; 5],
}

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = TokenInstruction::unpack(instruction_data)?;
    
    match instruction {
        TokenInstruction::Initialize => {
            msg!("Initialize token");
            let accounts_iter = &mut accounts.iter();
            let token_state_account = next_account_info(accounts_iter)?;
            let admin_account = next_account_info(accounts_iter)?;
            
            if !token_state_account.is_writable {
                return Err(ProgramError::InvalidAccountData);
            }
            
            let mut token_state = TokenState::default();
            token_state.admin.copy_from_slice(admin_account.key.as_ref());
            token_state.min_gold_redemption = 10_000_000_000;
            token_state.redemption_fee_bps = 30;
            
            let mut data = token_state_account.try_borrow_mut_data()?;
            let bytes = bytemuck::bytes_of(&token_state);
            data[..bytes.len()].copy_from_slice(bytes);
            
            msg!("Token initialized with admin: {}", admin_account.key);
            Ok(())
        }
        TokenInstruction::Mint { amount, gold_backed } => {
            msg!("Mint {} tokens, gold_backed: {}", amount, gold_backed);
            let accounts_iter = &mut accounts.iter();
            let token_state_account = next_account_info(accounts_iter)?;
            let admin_account = next_account_info(accounts_iter)?;
            let recipient_account = next_account_info(accounts_iter)?;
            
            if !admin_account.is_signer {
                return Err(ProgramError::MissingRequiredSignature);
            }
            
            let mut token_data = token_state_account.try_borrow_mut_data()?;
            let token_state = bytemuck::from_bytes_mut::<TokenState>(&mut token_data);
            
            if token_state.admin != admin_account.key.as_ref() {
                return Err(ProgramError::InvalidAccountData);
            }
            
            if gold_backed {
                let new_backed = token_state.gold_backed_supply.checked_add(amount).ok_or(ProgramError::ArithmeticOverflow)?;
                if new_backed > token_state.gold_reserves {
                    return Err(ProgramError::InvalidAccountData);
                }
                token_state.gold_backed_supply = new_backed;
            }
            
            token_state.total_supply = token_state.total_supply.checked_add(amount).ok_or(ProgramError::ArithmeticOverflow)?;
            
            msg!("Minted {} to {}", amount, recipient_account.key);
            Ok(())
        }
        TokenInstruction::Burn { amount } => {
            msg!("Burn {} tokens", amount);
            let accounts_iter = &mut accounts.iter();
            let token_state_account = next_account_info(accounts_iter)?;
            let admin_account = next_account_info(accounts_iter)?;
            let holder_account = next_account_info(accounts_iter)?;
            
            if !admin_account.is_signer {
                return Err(ProgramError::MissingRequiredSignature);
            }
            
            let mut token_data = token_state_account.try_borrow_mut_data()?;
            let token_state = bytemuck::from_bytes_mut::<TokenState>(&mut token_data);
            
            if token_state.admin != admin_account.key.as_ref() {
                return Err(ProgramError::InvalidAccountData);
            }
            
            if token_state.gold_backed_supply > 0 {
                let reduce = amount.min(token_state.gold_backed_supply);
                token_state.gold_backed_supply -= reduce;
            }
            
            token_state.total_supply = token_state.total_supply.checked_sub(amount).ok_or(ProgramError::ArithmeticOverflow)?;
            
            msg!("Burned {} from {}", amount, holder_account.key);
            Ok(())
        }
    }
}

#[derive(Debug)]
pub enum TokenInstruction {
    Initialize,
    Mint { amount: u64, gold_backed: bool },
    Burn { amount: u64 },
}

impl TokenInstruction {
    fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match tag {
            0 => Self::Initialize,
            1 => {
                let amount = u64::from_le_bytes(rest[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                let gold_backed = rest[8] != 0;
                Self::Mint { amount, gold_backed }
            }
            2 => {
                let amount = u64::from_le_bytes(rest[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                Self::Burn { amount }
            }
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
