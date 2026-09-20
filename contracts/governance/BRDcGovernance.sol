// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BRDcGovernance
 * @notice Governança simples de propostas para o ecossistema BRDc, emitida
 * pela AIBANK. Adaptado do GTKGovernance original, com uma correção de
 * segurança importante — ver nota abaixo.
 *
 * CORREÇÃO EM RELAÇÃO AO DESIGN ORIGINAL (GTKGovernance):
 * a versão original do GTK permitia que `vote(proposalId, support, votes)`
 * recebesse `votes` como parâmetro informado pelo próprio chamador, sem
 * checar contra nenhum saldo real de token. Isso significa que qualquer
 * endereço podia se autoatribuir qualquer quantidade de "votos" — uma
 * falha crítica que zera a legitimidade de qualquer votação. Esta versão
 * corrige isso: o peso do voto é sempre `brdcToken.balanceOf(msg.sender)`
 * no momento do voto, nunca um valor informado pelo chamador.
 *
 * LIMITAÇÃO CONHECIDA (documentada, não escondida): usar `balanceOf` no
 * momento do voto (em vez de um snapshot/checkpoint, como
 * `ERC20Votes`/`Governor` da OpenZeppelin) é vulnerável a ataque de
 * flash loan — pegar tokens emprestados, votar, devolver no mesmo bloco.
 * Para uma votação com valor econômico real em jogo, migre o BRDcToken
 * para `ERC20VotesUpgradeable` e esta governança para
 * `GovernorUpgradeable` da OpenZeppelin, que resolve isso via checkpoint
 * histórico de saldo. Esta versão é adequada para governança de baixo
 * risco (parâmetros operacionais, composição da cesta) enquanto o
 * projeto está em fase de protótipo/testnet — não para decisões com
 * grande valor financeiro em disputa.
 *
 * CORREÇÃO ADICIONAL: o quorum original checava `votes >= quorum` DENTRO
 * de cada voto individual (ou seja, um único votante precisava sozinho
 * ter saldo maior que o quorum inteiro para poder votar — não é isso que
 * "quorum" significa). Esta versão corrige para o sentido usual: quorum é
 * checado na EXECUÇÃO, como a soma de todos os votos (a favor + contra).
 */
contract BRDcGovernance is AccessControl {
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    IERC20 public immutable brdcToken;

    struct Proposal {
        uint256 id;
        string description;
        address target;
        bytes callData;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool canceled;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public proposalCount;
    uint256 public votingPeriod = 7 days;
    uint256 public quorum = 1000 * 10 ** 18;
    /// @notice Saldo mínimo de BRDc exigido para poder votar (anti-spam, não anti-flashloan).
    uint256 public minBalanceToVote = 1 * 10 ** 18;

    event ProposalCreated(uint256 indexed id, string description, address proposer);
    event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 votes);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCanceled(uint256 indexed id);
    event VotingPeriodUpdated(uint256 newPeriod);
    event QuorumUpdated(uint256 newQuorum);
    event MinBalanceToVoteUpdated(uint256 newMinBalance);

    constructor(address admin, address _brdcToken) {
        require(_brdcToken != address(0), "Gov: invalid token");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROPOSER_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        brdcToken = IERC20(_brdcToken);
    }

    function createProposal(
        string memory description,
        address target,
        bytes memory callData
    ) external onlyRole(PROPOSER_ROLE) returns (uint256) {
        uint256 id = proposalCount++;
        proposals[id] = Proposal({
            id: id,
            description: description,
            target: target,
            callData: callData,
            forVotes: 0,
            againstVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + votingPeriod,
            executed: false,
            canceled: false
        });
        emit ProposalCreated(id, description, msg.sender);
        return id;
    }

    /**
     * @notice Vota em uma proposta. O peso do voto é sempre o saldo atual
     * de BRDc do votante — não um valor informado por ele (essa era a
     * falha do design original que este contrato corrige).
     */
    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp < proposal.endTime, "Gov: voting ended");
        require(!proposal.executed && !proposal.canceled, "Gov: not active");
        require(!hasVoted[proposalId][msg.sender], "Gov: already voted");

        uint256 weight = brdcToken.balanceOf(msg.sender);
        require(weight >= minBalanceToVote, "Gov: balance below minimum to vote");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    function executeProposal(uint256 proposalId) external onlyRole(EXECUTOR_ROLE) {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.endTime, "Gov: voting ongoing");
        require(!proposal.executed && !proposal.canceled, "Gov: not active");
        require(proposal.forVotes > proposal.againstVotes, "Gov: rejected");
        require(proposal.forVotes + proposal.againstVotes >= quorum, "Gov: quorum not met");

        proposal.executed = true;
        (bool success, ) = proposal.target.call(proposal.callData);
        require(success, "Gov: execution failed");

        emit ProposalExecuted(proposalId);
    }

    function cancelProposal(uint256 proposalId) external onlyRole(PROPOSER_ROLE) {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Gov: already executed");
        proposal.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    function setVotingPeriod(uint256 _newPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        votingPeriod = _newPeriod;
        emit VotingPeriodUpdated(_newPeriod);
    }

    function setQuorum(uint256 _newQuorum) external onlyRole(DEFAULT_ADMIN_ROLE) {
        quorum = _newQuorum;
        emit QuorumUpdated(_newQuorum);
    }

    function setMinBalanceToVote(uint256 _newMinBalance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minBalanceToVote = _newMinBalance;
        emit MinBalanceToVoteUpdated(_newMinBalance);
    }
}
