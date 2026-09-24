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
pub struct GovState {
    pub admin: [u8; 32],
    pub voting_period: u64,
    pub quorum: u64,
    pub min_balance: u64,
    pub prop_count: u64,
}

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = GovernanceInstruction::unpack(instruction_data)?;
    
    match instruction {
        GovernanceInstruction::Initialize { voting_period, quorum, min_balance } => {
            msg!("Initialize governance");
            let accounts_iter = &mut accounts.iter();
            let gov_account = next_account_info(accounts_iter)?;
            let admin_account = next_account_info(accounts_iter)?;
            
            if !gov_account.is_writable {
                return Err(ProgramError::InvalidAccountData);
            }
            
            let mut gov_state = GovState::default();
            gov_state.admin.copy_from_slice(admin_account.key.as_ref());
            gov_state.voting_period = voting_period;
            gov_state.quorum = quorum;
            gov_state.min_balance = min_balance;
            
            let mut data = gov_account.try_borrow_mut_data()?;
            let bytes = bytemuck::bytes_of(&gov_state);
            data[..bytes.len()].copy_from_slice(bytes);
            
            msg!("Governance initialized");
            Ok(())
        }
        GovernanceInstruction::CreateProposal { description } => {
            msg!("Create proposal: {}", description);
            let accounts_iter = &mut accounts.iter();
            let gov_account = next_account_info(accounts_iter)?;
            let admin_account = next_account_info(accounts_iter)?;
            
            if !admin_account.is_signer {
                return Err(ProgramError::MissingRequiredSignature);
            }
            
            let mut gov_data = gov_account.try_borrow_mut_data()?;
            let gov_state = bytemuck::from_bytes_mut::<GovState>(&mut gov_data);
            
            if gov_state.admin != admin_account.key.as_ref() {
                return Err(ProgramError::InvalidAccountData);
            }
            
            gov_state.prop_count += 1;
            
            let count = gov_state.prop_count;
            msg!("Created proposal {}: {}", count, description);
            Ok(())
        }
        GovernanceInstruction::Vote { proposal_id, support } => {
            msg!("Vote on proposal {}: {}", proposal_id, if support { "YES" } else { "NO" });
            let accounts_iter = &mut accounts.iter();
            let gov_account = next_account_info(accounts_iter)?;
            let voter_account = next_account_info(accounts_iter)?;
            
            if !voter_account.is_signer {
                return Err(ProgramError::MissingRequiredSignature);
            }
            
            Ok(())
        }
        GovernanceInstruction::ExecuteProposal { proposal_id } => {
            msg!("Execute proposal {}", proposal_id);
            let accounts_iter = &mut accounts.iter();
            let gov_account = next_account_info(accounts_iter)?;
            let executor_account = next_account_info(accounts_iter)?;
            
            if !executor_account.is_signer {
                return Err(ProgramError::MissingRequiredSignature);
            }
            
            let mut gov_data = gov_account.try_borrow_mut_data()?;
            let gov_state = bytemuck::from_bytes_mut::<GovState>(&mut gov_data);
            
            if gov_state.admin != executor_account.key.as_ref() {
                return Err(ProgramError::InvalidAccountData);
            }
            
            msg!("Executed proposal {}", proposal_id);
            Ok(())
        }
    }
}

#[derive(Debug)]
pub enum GovernanceInstruction {
    Initialize { voting_period: u64, quorum: u64, min_balance: u64 },
    CreateProposal { description: String },
    Vote { proposal_id: u64, support: bool },
    ExecuteProposal { proposal_id: u64 },
}

impl GovernanceInstruction {
    fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match tag {
            0 => {
                let voting_period = u64::from_le_bytes(rest[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                let quorum = u64::from_le_bytes(rest[8..16].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                let min_balance = u64::from_le_bytes(rest[16..24].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                Self::Initialize { voting_period, quorum, min_balance }
            }
            1 => {
                let len = u32::from_le_bytes(rest[..4].try_into().map_err(|_| ProgramError::InvalidInstructionData)?) as usize;
                let desc = std::str::from_utf8(&rest[4..4+len]).map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::CreateProposal { description: desc.to_string() }
            }
            2 => {
                let proposal_id = u64::from_le_bytes(rest[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                let support = rest[8] != 0;
                Self::Vote { proposal_id, support }
            }
            3 => {
                let proposal_id = u64::from_le_bytes(rest[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
                Self::ExecuteProposal { proposal_id }
            }
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
