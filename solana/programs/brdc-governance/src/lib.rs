use anchor_lang::prelude::*;

declare_id!("51LkLzwGVtG73itS4h1oo9gXqyzityCb7hzyrWeGL9tD");

#[program]
pub mod brdc_governance {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.gov_state.initialize(
            ctx.accounts.admin.key(),
            &ctx.accounts.voting_params,
        );
        emit!(GovernanceInitializedEvent {
            admin: ctx.accounts.admin.key(),
            voting_period: ctx.accounts.gov_state.voting_period,
            quorum: ctx.accounts.gov_state.quorum,
            min_balance: ctx.accounts.gov_state.min_balance,
        });
        Ok(())
    }

    pub fn create_proposal(
        ctx: Context<CreateProp>,
        description: String,
    ) -> Result<()> {
        ctx.accounts.gov_state.create_proposal(
            ctx.accounts.admin.key(),
            description,
            &mut ctx.accounts.proposal,
        );
        Ok(())
    }

    pub fn vote(
        ctx: Context<VoteContext>,
        proposal_id: u64,
        support: bool,
    ) -> Result<()> {
        ctx.accounts.gov_state.cast_vote(
            ctx.accounts.admin.key(),
            proposal_id,
            support,
            &mut ctx.accounts.voter,
            &mut ctx.accounts.proposal,
        );
        Ok(())
    }

    pub fn execute_proposal(
        ctx: Context<ExecuteProp>,
        proposal_id: u64,
    ) -> Result<()> {
        ctx.accounts.gov_state.execute_proposal(
            ctx.accounts.executor.key(),
            proposal_id,
            &mut ctx.accounts.proposal,
        );
        Ok(())
    }

    pub fn cancel_proposal(
        ctx: Context<CancelProp>,
        proposal_id: u64,
    ) -> Result<()> {
        ctx.accounts.gov_state.cancel_proposal(
            ctx.accounts.admin.key(),
            proposal_id,
            &mut ctx.accounts.proposal,
        );
        Ok(())
    }

    pub fn set_voting_period(
        ctx: Context<SetVotingPeriod>,
        period: u64,
    ) -> Result<()> {
        ctx.accounts.gov_state
            .set_voting_period(ctx.accounts.admin.key(), period);
        Ok(())
    }

    pub fn set_quorum(ctx: Context<SetQuorum>, quorum: u64) -> Result<()> {
        ctx.accounts.gov_state
            .set_quorum(ctx.accounts.admin.key(), quorum);
        Ok(())
    }

    pub fn set_min_balance(
        ctx: Context<SetMinBalance>,
        mb: u64,
    ) -> Result<()> {
        ctx.accounts.gov_state
            .set_min_balance(ctx.accounts.admin.key(), mb);
        Ok(())
    }

    pub fn get_proposal(
        ctx: Context<GetProposalContext>,
        proposal_id: u64,
    ) -> Result<()> {
        ctx.accounts.proposal.emit_proposal(proposal_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(seeds = [b"gov_state"], bump)]
    pub gov_state: Account<'info, GovState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub voting_params: Account<'info, VotingParams>,
    pub payer: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateProp<'info> {
    #[account(seeds = [b"gov_state"], bump)]
    pub gov_state: Account<'info, GovState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub voter: Account<'info, VoterAccount>,
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoteContext<'info> {
    #[account(seeds = [b"gov_state"], bump)]
    pub gov_state: Account<'info, GovState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub voter: Account<'info, VoterAccount>,
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteProp<'info> {
    #[account(seeds = [b"gov_state"], bump)]
    pub gov_state: Account<'info, GovState>,
    pub executor: AccountInfo<'info>,
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelProp<'info> {
    #[account(seeds = [b"gov_state"], bump)]
    pub gov_state: Account<'info, GovState>,
    pub admin: AccountInfo<'info>,
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetVotingPeriod<'info> {
    #[account(seeds = [b"gov_state"], bump)]
    pub gov_state: Account<'info, GovState>,
    pub admin: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetQuorum<'info> {
    #[account(seeds = [b"gov_state"], bump)]
    pub gov_state: Account<'info, GovState>,
    pub admin: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetMinBalance<'info> {
    #[account(seeds = [b"gov_state"], bump)]
    pub gov_state: Account<'info, GovState>,
    pub admin: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetProposalContext<'info> {
    #[account(seeds = [b"gov_state"], bump)]
    pub gov_state: Account<'info, GovState>,
    #[account(
        seeds = [b"proposal", proposal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct GovState {
    pub admin: Pubkey,
    pub voting_period: u64,
    pub quorum: u64,
    pub min_balance: u64,
    pub prop_count: u64,
    pub bump: u8,
}

impl GovState {
    pub fn initialize(&mut self, admin: Pubkey, voting_params: &VotingParams) {
        self.admin = admin;
        self.voting_period = voting_params.voting_period;
        self.quorum = voting_params.quorum;
        self.min_balance = voting_params.min_balance;
        self.prop_count = 0;
        self.bump = 0;
    }

    pub fn create_proposal(
        &mut self,
        admin: Pubkey,
        description: String,
        proposal: &mut Proposal,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if !proposal.is_active() {
            return err!(3);
        }

        self.prop_count += 1;
        let id = self.prop_count;
        let now = Clock::get().unwrap().unix_timestamp;

        proposal.initialize(id, description, now, self.voting_period);

        emit!(ProposalCreatedEvent {
            id,
            description: description.into_bytes(),
            proposer: admin,
        });
        Ok(())
    }

    pub fn cast_vote(
        &mut self,
        admin: Pubkey,
        proposal_id: u64,
        support: bool,
        voter: &mut VoterAccount,
        proposal: &mut Proposal,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if proposal.id != proposal_id {
            return err!(4);
        }
        let now = Clock::get().unwrap().unix_timestamp;
        if now >= proposal.end_time {
            return err!(2);
        }
        if proposal.executed || proposal.canceled {
            return err!(3);
        }
        if voter.has_voted(proposal_id) {
            return err!(5);
        }

        let weight = voter.balance;
        if weight < self.min_balance {
            return err!(8);
        }

        voter.mark_voted(proposal_id);

        if support {
            proposal.for_votes = match proposal.for_votes.checked_add(weight) {
                Some(v) => v,
                None => return err!(6),
            };
        } else {
            proposal.against_votes = match proposal.against_votes.checked_add(weight) {
                Some(v) => v,
                None => return err!(6),
            };
        }
        proposal.voted_count += 1;

        emit!(VoteCastEvent {
            proposal_id,
            voter: voter.key(),
            support,
            weight,
        });
        Ok(())
    }

    pub fn execute_proposal(
        &mut self,
        executor: Pubkey,
        proposal_id: u64,
        proposal: &mut Proposal,
    ) -> Result<()> {
        if self.admin != executor {
            return err!(1);
        }
        if proposal.id != proposal_id {
            return err!(4);
        }
        let now = Clock::get().unwrap().unix_timestamp;
        if now < proposal.end_time {
            return err!(7);
        }
        if proposal.executed || proposal.canceled {
            return err!(3);
        }
        if proposal.for_votes <= proposal.against_votes {
            return err!(9);
        }
        let total = match proposal.for_votes.checked_add(proposal.against_votes) {
            Some(v) => v,
            None => return err!(6),
        };
        if total < self.quorum {
            return err!(10);
        }

        proposal.executed = true;
        emit!(ProposalExecutedEvent { proposal_id });
        Ok(())
    }

    pub fn cancel_proposal(
        &mut self,
        admin: Pubkey,
        proposal_id: u64,
        proposal: &mut Proposal,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if proposal.id != proposal_id {
            return err!(4);
        }
        if proposal.executed {
            return err!(11);
        }
        proposal.canceled = true;
        emit!(ProposalCanceledEvent { proposal_id });
        Ok(())
    }

    pub fn set_voting_period(
        &mut self,
        admin: Pubkey,
        period: u64,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if period == 0 {
            return err!(12);
        }
        self.voting_period = period;
        emit!(VotingPeriodUpdatedEvent { new_period: period });
        Ok(())
    }

    pub fn set_quorum(&mut self, admin: Pubkey, quorum: u64) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if quorum == 0 {
            return err!(13);
        }
        self.quorum = quorum;
        emit!(QuorumUpdatedEvent { new_quorum: quorum });
        Ok(())
    }

    pub fn set_min_balance(
        &mut self,
        admin: Pubkey,
        mb: u64,
    ) -> Result<()> {
        if self.admin != admin {
            return err!(1);
        }
        if mb == 0 {
            return err!(14);
        }
        self.min_balance = mb;
        emit!(MinBalanceUpdatedEvent { new_min_balance: mb });
        Ok(())
    }
}

#[account]
pub struct VotingParams {
    pub voting_period: u64,
    pub quorum: u64,
    pub min_balance: u64,
    pub bump: u8,
}

#[account]
pub struct VoterAccount {
    pub balance: u64,
    pub is_active: bool,
    pub has_voted: [bool; 100],
}

impl VoterAccount {
    pub fn has_voted(&self, proposal_id: u64) -> bool {
        if proposal_id < 100 {
            self.has_voted[proposal_id as usize]
        } else {
            false
        }
    }

    pub fn mark_voted(&mut self, proposal_id: u64) {
        if proposal_id < 100 {
            self.has_voted[proposal_id as usize] = true;
        }
    }
}

#[account]
pub struct Proposal {
    pub id: u64,
    pub description: Vec<u8>,
    pub start_time: i64,
    pub end_time: i64,
    pub for_votes: u64,
    pub against_votes: u64,
    pub executed: bool,
    pub canceled: bool,
    pub voted_count: u64,
    pub bump: u8,
}

impl Proposal {
    pub fn initialize(
        &mut self,
        id: u64,
        description: String,
        start_time: i64,
        voting_period: u64,
    ) {
        self.id = id;
        self.description = description.into_bytes();
        self.start_time = start_time;
        self.end_time = start_time + voting_period as i64;
        self.for_votes = 0;
        self.against_votes = 0;
        self.executed = false;
        self.canceled = false;
        self.voted_count = 0;
        self.bump = 0;
    }

    pub fn is_active(&self) -> bool {
        !self.executed && !self.canceled
    }

    pub fn emit_proposal(&self, proposal_id: u64) -> Result<()> {
        if self.id != proposal_id {
            return err!(4);
        }
        emit!(ProposalRetrievedEvent {
            id: self.id,
            description: self.description.clone(),
            for_votes: self.for_votes,
            against_votes: self.against_votes,
            executed: self.executed,
            canceled: self.canceled,
            start_time: self.start_time,
            end_time: self.end_time,
            voted_count: self.voted_count,
        });
        Ok(())
    }
}

#[event]
pub struct GovernanceInitializedEvent {
    pub admin: Pubkey,
    pub voting_period: u64,
    pub quorum: u64,
    pub min_balance: u64,
}

#[event]
pub struct ProposalCreatedEvent {
    pub id: u64,
    pub description: Vec<u8>,
    pub proposer: Pubkey,
}

#[event]
pub struct VoteCastEvent {
    pub proposal_id: u64,
    pub voter: Pubkey,
    pub support: bool,
    pub weight: u64,
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
pub struct MinBalanceUpdatedEvent {
    pub new_min_balance: u64,
}

#[event]
pub struct ProposalRetrievedEvent {
    pub id: u64,
    pub description: Vec<u8>,
    pub for_votes: u64,
    pub against_votes: u64,
    pub executed: bool,
    pub canceled: bool,
    pub start_time: i64,
    pub end_time: i64,
    pub voted_count: u64,
}
