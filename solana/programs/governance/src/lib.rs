use anchor_lang::prelude::*;

declare_id!("BjQ56a3gZ9QA41juyQ7hDdUG5XLocrSUzeeBtq1");

#[program]
pub mod brdc_governance {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.governance_state;
        state.admin = ctx.accounts.admin.key();
        state.brdc_token = ctx.accounts.token.key();
        state.proposal_count = 0;
        state.voting_period = 7 * 24 * 60 * 60; // 7 days in seconds
        state.quorum = 1000 * 10_u64.pow(18) as u64;
        state.min_balance_to_vote = 1 * 10_u64.pow(18) as u64;
        Ok(())
    }

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        description: String,
        target: Pubkey,
        call_data: Vec<u8>,
    ) -> Result<()> {
        let state = &mut ctx.accounts.governance_state;
        require!(ctx.accounts.proposer.key() == state.admin, BRDC_GOVERNANCE_ERRORS::UNAUTHORIZED);

        let proposal_id = state.proposal_count;
        state.proposal_count += 1;

        ctx.accounts.proposal.proposal_id = proposal_id;
        ctx.accounts.proposal.description = description;
        ctx.accounts.proposal.target = target;
        ctx.accounts.proposal.call_data = call_data.clone();
        ctx.accounts.proposal.for_votes = 0;
        ctx.accounts.proposal.against_votes = 0;
        ctx.accounts.proposal.start_time = Clock::get().unwrap().unix_timestamp;
        ctx.accounts.proposal.end_time = Clock::get().unwrap().unix_timestamp + state.voting_period as i64;
        ctx.accounts.proposal.executed = false;
        ctx.accounts.proposal.canceled = false;

        emit ProposalCreatedEvent {
            id: proposal_id,
            description,
            proposer: ctx.accounts.proposer.key(),
        };
        Ok(())
    }

    pub fn vote(ctx: Context<Vote>, proposal_id: u64, support: bool) -> Result<()> {
        let state = &mut ctx.accounts.governance_state;
        let proposal = &mut ctx.accounts.proposal;
        require!(Clock::get().unwrap().unix_timestamp < proposal.end_time, BRDC_GOVERNANCE_ERRORS::VOTING_ENDED);
        require!(proposal.executed == false && proposal.canceled == false, BRDC_GOVERNANCE_ERRORS::NOT_ACTIVE);
        require!(ctx.accounts.has_voted.has_voted(proposal_id, ctx.accounts.voter.key()) == false, BRDC_GOVERNANCE_ERRORS::ALREADY_VOTED);

        let weight = ctx.accounts.voter.balance;
        require!(weight >= state.min_balance_to_vote, BRDC_GOVERNANCE_ERRORS::BALANCE_BELOW_MINIMUM);

        ctx.accounts.has_voted.set_has_voted(proposal_id, ctx.accounts.voter.key(), true);

        if support {
            proposal.for_votes += weight;
        } else {
            proposal.against_votes += weight;
        }

        emit VoteCastEvent {
            proposal_id,
            voter: ctx.accounts.voter.key(),
            support,
            votes: weight,
        };
        Ok(())
    }

    pub fn execute_proposal(ctx: Context<ExecuteProposal>, proposal_id: u64) -> Result<()> {
        let state = &mut ctx.accounts.governance_state;
        let proposal = &mut ctx.accounts.proposal;
        require!(Clock::get().unwrap().unix_timestamp >= proposal.end_time, BRDC_GOVERNANCE_ERRORS::VOTING_ONGOING);
        require!(proposal.executed == false && proposal.canceled == false, BRDC_GOVERNANCE_ERRORS::NOT_ACTIVE);
        require!(proposal.for_votes > proposal.against_votes, BRDC_GOVERNANCE_ERRORS::REJECTED);
        require!(
            proposal.for_votes + proposal.against_votes >= state.quorum,
            BRDC_GOVERNANCE_ERRORS::QUORUM_NOT_MET
        );

        proposal.executed = true;

        // Execute the call — simplified for testnet
        // Em produção, isso faria uma CPI para o programa target
        emit ProposalExecutedEvent {
            proposal_id,
        };
        Ok(())
    }

    pub fn cancel_proposal(ctx: Context<CancelProposal>, proposal_id: u64) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        require!(proposal.executed == false, BRDC_GOVERNANCE_ERRORS::ALREADY_EXECUTED);
        require!(ctx.accounts.proposer.key() == ctx.accounts.governance_state.admin, BRDC_GOVERNANCE_ERRORS::UNAUTHORIZED);
        proposal.canceled = true;

        emit ProposalCanceledEvent {
            proposal_id,
        };
        Ok(())
    }

    pub fn set_voting_period(ctx: Context<SetVotingPeriod>, new_period: u64) -> Result<()> {
        let state = &mut ctx.accounts.governance_state;
        require!(ctx.accounts.admin.key() == state.admin, BRDC_GOVERNANCE_ERRORS::UNAUTHORIZED);
        state.voting_period = new_period;
        emit VotingPeriodUpdatedEvent {
            new_period,
        };
        Ok(())
    }

    pub fn set_quorum(ctx: Context<SetQuorum>, new_quorum: u64) -> Result<()> {
        let state = &mut ctx.accounts.governance_state;
        require!(ctx.accounts.admin.key() == state.admin, BRDC_GOVERNANCE_ERRORS::UNAUTHORIZED);
        state.quorum = new_quorum;
        emit QuorumUpdatedEvent {
            new_quorum,
        };
        Ok(())
    }

    pub fn set_min_balance_to_vote(ctx: Context<SetMinBalance>, new_min_balance: u64) -> Result<()> {
        let state = &mut ctx.accounts.governance_state;
        require!(ctx.accounts.admin.key() == state.admin, BRDC_GOVERNANCE_ERRORS::UNAUTHORIZED);
        state.min_balance_to_vote = new_min_balance;
        emit MinBalanceToVoteUpdatedEvent {
            new_min_balance,
        };
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 32 + 32 + 8 + 8 + 8 + 8)]
    pub governance_state: Account<'info, GovernanceState>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub token: Account<'info, TokenState>,
    #[account(mut)]
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub governance_state: Account<'info, GovernanceState>,
    #[account(init, payer = proposer, space = 8 + 32 + 4 + 32 + 4 + 8 + 8 + 8 + 1 + 1)]
    pub proposal: Account<'info, Proposal>,
    pub proposer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub governance_state: Account<'info, GovernanceState>,
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub voter: Account<'info, Voter>,
    #[account(mut)]
    pub has_voted: Account<'info, HasVoted>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub governance_state: Account<'info, GovernanceState>,
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    pub executor: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelProposal<'info> {
    #[account(mut)]
    pub governance_state: Account<'info, GovernanceState>,
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    pub proposer: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetVotingPeriod<'info> {
    #[account(mut)]
    pub governance_state: Account<'info, GovernanceState>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetQuorum<'info> {
    #[account(mut)]
    pub governance_state: Account<'info, GovernanceState>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetMinBalance<'info> {
    #[account(mut)]
    pub governance_state: Account<'info, GovernanceState>,
    pub admin: Signer<'info>,
}

#[account]
pub struct GovernanceState {
    pub admin: Pubkey,
    pub brdc_token: Pubkey,
    pub proposal_count: u64,
    pub voting_period: u64,
    pub quorum: u64,
    pub min_balance_to_vote: u64,
}

#[account]
pub struct Proposal {
    pub proposal_id: u64,
    pub description: String,
    pub target: Pubkey,
    pub call_data: Vec<u8>,
    pub for_votes: u64,
    pub against_votes: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub executed: bool,
    pub canceled: bool,
}

#[account]
pub struct Voter {
    pub balance: u64,
}

#[account]
pub struct HasVoted {
    pub has_voted_map: std::collections::HashMap<Pubkey, bool>,
}

impl HasVoted {
    pub fn has_voted(&self, proposal_id: u64, voter: Pubkey) -> bool {
        self.has_voted_map.get(&voter).copied().unwrap_or(false)
    }

    pub fn set_has_voted(&mut self, proposal_id: u64, voter: Pubkey, value: bool) {
        self.has_voted_map.insert(voter, value);
    }
}

#[account]
pub struct TokenState {
    pub admin: Pubkey,
}

#[error]
pub enum BRDC_GOVERNANCE_ERRORS {
    UNAUTHORIZED,
    VOTING_ENDED,
    NOT_ACTIVE,
    ALREADY_VOTED,
    BALANCE_BELOW_MINIMUM,
    VOTING_ONGOING,
    REJECTED,
    QUORUM_NOT_MET,
    ALREADY_EXECUTED,
}

#[event]
pub struct ProposalCreatedEvent {
    pub id: u64,
    pub description: String,
    pub proposer: Pubkey,
}

#[event]
pub struct VoteCastEvent {
    pub proposal_id: u64,
    pub voter: Pubkey,
    pub support: bool,
    pub votes: u64,
}

#[event]
pub struct ProposalExecutedEvent {
    pub proposal_id: u64,
}

#[event]
pub struct ProposalCanceledEvent {
    pub proposal_id: u64,
}

#[event]
pub struct VotingPeriodUpdatedEvent {
    pub new_period: u64,
}

#[event]
pub struct QuorumUpdatedEvent {
    pub new_quorum: u64,
}

#[event]
pub struct MinBalanceToVoteUpdatedEvent {
    pub new_min_balance: u64,
}
