use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{clock::Clock, Sysvar},
};
use bytemuck::{Pod, Zeroable};

entrypoint!(process_instruction);

#[repr(C)]
#[derive(Debug, Default, Copy, Clone, Pod, Zeroable)]
pub struct BridgeState {
    pub admin: [u8; 32],
    pub last_nav: u64,
    pub last_update_timestamp: i64,
}

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = OracleInstruction::unpack(instruction_data)?;
    
    match instruction {
        OracleInstruction::Initialize => {
            msg!("Initialize bridge");
            let accounts_iter = &mut accounts.iter();
            let bridge_account = next_account_info(accounts_iter)?;
            let admin_account = next_account_info(accounts_iter)?;
            
            if !bridge_account.is_writable {
                return Err(ProgramError::InvalidAccountData);
            }
            
            let mut bridge_state = BridgeState::default();
            bridge_state.admin.copy_from_slice(admin_account.key.as_ref());
            bridge_state.last_nav = 0;
            bridge_state.last_update_timestamp = 0;
            
            let mut data = bridge_account.try_borrow_mut_data()?;
            let bytes = bytemuck::bytes_of(&bridge_state);
            data[..bytes.len()].copy_from_slice(bytes);
            
            msg!("Bridge initialized with admin: {}", admin_account.key);
            Ok(())
        }
        OracleInstruction::UpdateNav { new_nav } => {
            msg!("Update NAV: {}", new_nav);
            let accounts_iter = &mut accounts.iter();
            let bridge_account = next_account_info(accounts_iter)?;
            let admin_account = next_account_info(accounts_iter)?;
            
            if !admin_account.is_signer {
                return Err(ProgramError::MissingRequiredSignature);
            }
            
            let mut bridge_data = bridge_account.try_borrow_mut_data()?;
            let bridge_state = bytemuck::from_bytes_mut::<BridgeState>(&mut bridge_data);
            
            if bridge_state.admin != admin_account.key.as_ref() {
                return Err(ProgramError::InvalidAccountData);
            }
            
            let clock = Clock::get()?;
            bridge_state.last_nav = new_nav;
            bridge_state.last_update_timestamp = clock.unix_timestamp;
            
            let nav = bridge_state.last_nav;
            let timestamp = bridge_state.last_update_timestamp;
            msg!("NAV updated to {} at {}", nav, timestamp);
            Ok(())
        }
        OracleInstruction::GetNav => {
            msg!("Get NAV");
            let accounts_iter = &mut accounts.iter();
            let bridge_account = next_account_info(accounts_iter)?;
            
            let bridge_data = bridge_account.try_borrow_data()?;
            let bridge_state = bytemuck::from_bytes::<BridgeState>(&bridge_data);
            
            if bridge_state.last_nav == 0 {
                return Err(ProgramError::InvalidAccountData);
            }
            
            let nav = bridge_state.last_nav;
            let timestamp = bridge_state.last_update_timestamp;
            msg!("Current NAV: {}, updated at {}", nav, timestamp);
            Ok(())
        }
    }
}

#[derive(Debug)]
pub enum OracleInstruction {
    Initialize,
    UpdateNav { new_nav: u64 },
    GetNav,
}

impl OracleInstruction {
    fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match tag {
            0 => Self::Initialize,
            1 => {
                let new_nav = u64::from_le_bytes(rest[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                Self::UpdateNav { new_nav }
            }
            2 => Self::GetNav,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
