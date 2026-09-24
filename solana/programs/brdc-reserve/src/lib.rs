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
pub struct ReserveState {
    pub admin: [u8; 32],
    pub balance: u64,
    pub settler: [u8; 32],
    pub redeem_count: u64,
    pub snapshot_count: u64,
}

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = ReserveInstruction::unpack(instruction_data)?;
    
    match instruction {
        ReserveInstruction::Initialize => {
            msg!("Initialize reserve");
            let accounts_iter = &mut accounts.iter();
            let reserve_account = next_account_info(accounts_iter)?;
            let admin_account = next_account_info(accounts_iter)?;
            
            if !reserve_account.is_writable {
                return Err(ProgramError::InvalidAccountData);
            }
            
            let mut reserve_state = ReserveState::default();
            reserve_state.admin.copy_from_slice(admin_account.key.as_ref());
            reserve_state.settler.copy_from_slice(admin_account.key.as_ref());
            
            let mut data = reserve_account.try_borrow_mut_data()?;
            let bytes = bytemuck::bytes_of(&reserve_state);
            data[..bytes.len()].copy_from_slice(bytes);
            
            msg!("Reserve initialized with admin: {}", admin_account.key);
            Ok(())
        }
        ReserveInstruction::DepositTreasury { amount } => {
            msg!("Deposit {} to treasury", amount);
            let accounts_iter = &mut accounts.iter();
            let reserve_account = next_account_info(accounts_iter)?;
            let admin_account = next_account_info(accounts_iter)?;
            
            if !admin_account.is_signer {
                return Err(ProgramError::MissingRequiredSignature);
            }
            
            let mut reserve_data = reserve_account.try_borrow_mut_data()?;
            let reserve_state = bytemuck::from_bytes_mut::<ReserveState>(&mut reserve_data);
            
            if reserve_state.admin != admin_account.key.as_ref() {
                return Err(ProgramError::InvalidAccountData);
            }
            
            reserve_state.balance = reserve_state.balance.checked_add(amount).ok_or(ProgramError::ArithmeticOverflow)?;
            
            msg!("Deposited {} to treasury", amount);
            Ok(())
        }
        ReserveInstruction::RegisterRedemption { brdc_amount } => {
            msg!("Register redemption for {} BRDc", brdc_amount);
            let accounts_iter = &mut accounts.iter();
            let reserve_account = next_account_info(accounts_iter)?;
            let settler_account = next_account_info(accounts_iter)?;
            
            if !settler_account.is_signer {
                return Err(ProgramError::MissingRequiredSignature);
            }
            
            let mut reserve_data = reserve_account.try_borrow_mut_data()?;
            let reserve_state = bytemuck::from_bytes_mut::<ReserveState>(&mut reserve_data);
            
            if reserve_state.settler != settler_account.key.as_ref() {
                return Err(ProgramError::InvalidAccountData);
            }
            
            reserve_state.redeem_count += 1;
            
            let count = reserve_state.redeem_count;
            msg!("Registered redemption {} for {} BRDc", count, brdc_amount);
            Ok(())
        }
        ReserveInstruction::SettleRedemption { request_id } => {
            msg!("Settle redemption {}", request_id);
            let accounts_iter = &mut accounts.iter();
            let reserve_account = next_account_info(accounts_iter)?;
            let settler_account = next_account_info(accounts_iter)?;
            
            if !settler_account.is_signer {
                return Err(ProgramError::MissingRequiredSignature);
            }
            
            let mut reserve_data = reserve_account.try_borrow_mut_data()?;
            let reserve_state = bytemuck::from_bytes_mut::<ReserveState>(&mut reserve_data);
            
            if reserve_state.settler != settler_account.key.as_ref() {
                return Err(ProgramError::InvalidAccountData);
            }
            
            msg!("Settled redemption {}", request_id);
            Ok(())
        }
    }
}

#[derive(Debug)]
pub enum ReserveInstruction {
    Initialize,
    DepositTreasury { amount: u64 },
    RegisterRedemption { brdc_amount: u64 },
    SettleRedemption { request_id: u64 },
}

impl ReserveInstruction {
    fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match tag {
            0 => Self::Initialize,
            1 => {
                let amount = u64::from_le_bytes(rest[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                Self::DepositTreasury { amount }
            }
            2 => {
                let brdc_amount = u64::from_le_bytes(rest[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                Self::RegisterRedemption { brdc_amount }
            }
            3 => {
                let request_id = u64::from_le_bytes(rest[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                Self::SettleRedemption { request_id }
            }
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
