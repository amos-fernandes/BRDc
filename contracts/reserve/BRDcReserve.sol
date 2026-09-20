// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IBRDcBasketOracle.sol";

/**
 * @title BRDcReserve
 * @notice Camada de liquidação para a fração NÃO-OURO da cesta (minérios +
 * commodities). Emitido/operado por AIBANK.
 *
 * PRINCÍPIO CENTRAL: esta fração nunca é entregue em espécie (não existe
 * "saque de minério de ferro"). Quem sai dessa exposição faz burn() no
 * BRDcToken e recebe aqui o equivalente em caixa (stablecoin de
 * liquidação, ex.: USDC na Base) ao NAV vigente — como o resgate de uma
 * cota de fundo, não como saque de um depósito físico.
 *
 * Este contrato NÃO tem acesso ao ouro custodiado (isso é só no
 * BRDcToken/AIBANK). Ele só movimenta o caixa/lastro em stablecoin que
 * respalda a fração NAV da cesta.
 *
 * TRANSPARÊNCIA OBRIGATÓRIA (proof-of-reserve): o saldo de
 * `settlementAsset` neste contrato deve, por política operacional da
 * AIBANK, refletir de forma auditável o caixa/colateral (ex.: posições
 * em ETFs de commodities, contratos futuros liquidados, recebíveis de
 * exportação) que sustentam a fração não-ouro do NAV. Este contrato só
 * garante a mecânica on-chain — a auditoria da adequação do colateral
 * off-chain é responsabilidade de governança/compliance da AIBANK, não
 * algo que o Solidity consegue garantir sozinho. Não represente este
 * saldo como "prova automática de reservas" sem essa auditoria externa.
 */
contract BRDcReserve is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    IERC20 public settlementAsset; // ex.: USDC na Base
    IBRDcBasketOracle public basketOracle;
    address public brdcToken;

    uint256 public constant REDEMPTION_FEE_BPS = 30;
    uint256 public constant BPS_DENOMINATOR = 10000;

    struct RedemptionRequest {
        address requester;
        uint256 brdcAmountBurned;
        uint256 navAtRequest;
        uint256 settlementAmountDue;
        bool settled;
        uint256 requestedAt;
    }
    mapping(uint256 => RedemptionRequest) public redemptionRequests;
    uint256 public redemptionRequestCount;

    event TreasuryDeposited(address indexed from, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount, string reason);
    event RedemptionRequested(uint256 indexed requestId, address indexed requester, uint256 brdcAmount, uint256 navAtRequest, uint256 settlementDue);
    event RedemptionSettled(uint256 indexed requestId, address indexed requester, uint256 amountPaid);
    event ProofOfReserveSnapshot(uint256 settlementBalance, uint256 timestamp, string note);

    constructor(address admin, address _settlementAsset, address _basketOracle, address _brdcToken) {
        require(_settlementAsset != address(0), "Reserve: invalid asset");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);
        _grantRole(SETTLER_ROLE, admin);

        settlementAsset = IERC20(_settlementAsset);
        basketOracle = IBRDcBasketOracle(_basketOracle);
        brdcToken = _brdcToken;
    }

    /// @notice AIBANK deposita caixa/colateral de liquidação (ex.: USDC) que sustenta a fração NAV.
    function depositTreasury(uint256 amount) external onlyRole(TREASURY_ROLE) nonReentrant {
        require(amount > 0, "Reserve: zero amount");
        settlementAsset.safeTransferFrom(msg.sender, address(this), amount);
        emit TreasuryDeposited(msg.sender, amount);
    }

    function withdrawTreasury(uint256 amount, string calldata reason) external onlyRole(TREASURY_ROLE) nonReentrant {
        require(amount <= settlementAsset.balanceOf(address(this)), "Reserve: insufficient balance");
        settlementAsset.safeTransfer(msg.sender, amount);
        emit TreasuryWithdrawn(msg.sender, amount, reason);
    }

    /**
     * @notice Registra uma solicitação de resgate em caixa após o holder já
     * ter feito burn() dos BRDc correspondentes no token principal. A
     * queima acontece no BRDcToken; este contrato só cuida da liquidação
     * financeira — separação deliberada de responsabilidade.
     * @dev `brdcAmountBurned` deve ser confirmado off-chain (ou via evento
     * indexado do BRDcToken) pelo SETTLER_ROLE antes de chamar esta
     * função, para evitar liquidar uma queima que não ocorreu.
     */
    function registerRedemption(address requester, uint256 brdcAmountBurned)
        external
        onlyRole(SETTLER_ROLE)
        returns (uint256 requestId)
    {
        require(brdcAmountBurned > 0, "Reserve: zero amount");

        uint256 nav = basketOracle.computeNAV(); // 8 casas decimais, USD
        // Conversão simplificada NAV(USD,8dec) -> settlementAsset (assume 6 decimais, ex. USDC).
        // Ajuste este cálculo conforme os decimais reais do settlementAsset em produção.
        uint256 grossDue = (brdcAmountBurned * nav) / 1e20;
        uint256 fee = (grossDue * REDEMPTION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netDue = grossDue - fee;

        require(netDue <= settlementAsset.balanceOf(address(this)), "Reserve: insufficient treasury for settlement");

        requestId = redemptionRequestCount++;
        redemptionRequests[requestId] = RedemptionRequest({
            requester: requester,
            brdcAmountBurned: brdcAmountBurned,
            navAtRequest: nav,
            settlementAmountDue: netDue,
            settled: false,
            requestedAt: block.timestamp
        });

        emit RedemptionRequested(requestId, requester, brdcAmountBurned, nav, netDue);
    }

    function settleRedemption(uint256 requestId) external onlyRole(SETTLER_ROLE) nonReentrant {
        RedemptionRequest storage req = redemptionRequests[requestId];
        require(!req.settled, "Reserve: already settled");
        req.settled = true;

        settlementAsset.safeTransfer(req.requester, req.settlementAmountDue);
        emit RedemptionSettled(requestId, req.requester, req.settlementAmountDue);
    }

    /// @notice Publica um snapshot on-chain do caixa de liquidação, para consumo por relatórios de proof-of-reserve.
    function publishReserveSnapshot(string calldata note) external onlyRole(TREASURY_ROLE) {
        emit ProofOfReserveSnapshot(settlementAsset.balanceOf(address(this)), block.timestamp, note);
    }

    function getReserveBalance() external view returns (uint256) {
        return settlementAsset.balanceOf(address(this));
    }
}
