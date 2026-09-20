// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IBRDcBasketOracle.sol";

/**
 * @title BRDcToken
 * @notice Emitido por AIBANK. Token de índice (ERC-20 upgradeable) que
 * acompanha o NAV de uma cesta de ativos reais brasileiros (ouro +
 * minérios + commodities), com resgate físico restrito à FRAÇÃO DE OURO
 * efetivamente custodiada pela própria AIBANK — nunca com referência a
 * reservas de terceiros, públicas ou privadas.
 *
 * =====================================================================
 * LEIA ANTES DE MODIFICAR OU IMPLANTAR EM MAINNET
 * =====================================================================
 * 1. O LASTRO EM OURO DESTE CONTRATO CORRESPONDE EXCLUSIVAMENTE A OURO
 *    FISICAMENTE CUSTODIADO PELA AIBANK (ver depositGold/CustodyRecord).
 *    Nunca referencie, direta ou indiretamente, reservas de ouro do
 *    Banco Central do Brasil, de outro país, ou de qualquer terceiro
 *    sobre o qual a AIBANK não tenha custódia e direito de disposição
 *    real. Declarar lastro inexistente é fraude (CP art. 171), não um
 *    risco regulatório a mitigar — não há "versão mais cuidadosa" disso.
 * 2. ESTE CONTRATO NÃO É "REAL DIGITAL", NÃO É EMITIDO, ENDOSSADO OU
 *    AFILIADO AO BANCO CENTRAL DO BRASIL, E NÃO TEM CURSO LEGAL. É um
 *    criptoativo privado da AIBANK, nos termos da Lei 14.478/2022. Não
 *    use "Real Digital", "moeda digital do Real" ou termos equivalentes
 *    em nenhuma comunicação pública.
 * 3. NÃO PROMETA "VALORIZAÇÃO DO REAL" em material de divulgação. Este
 *    token pode, no máximo, oferecer exposição tokenizada a uma cesta de
 *    ativos reais brasileiros — não influencia a taxa de câmbio do BRL.
 * 4. Dependendo de como for ofertado ao público, este token pode se
 *    enquadrar como valor mobiliário perante a CVM (Lei 6.385/76, art.
 *    2º, IX; Parecer de Orientação CVM 40/2022). Busque parecer jurídico
 *    antes de qualquer oferta pública ampla.
 * =====================================================================
 */
contract BRDcToken is
    ERC20Upgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant CUSTODIAN_ROLE = keccak256("CUSTODIAN_ROLE"); // papel operado pela AIBANK

    uint8 public constant TOKEN_DECIMALS = 18;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant REDEMPTION_FEE_BPS = 50;
    uint256 public constant MIN_GOLD_REDEMPTION_GRAMS = 100 * 10 ** 18;

    IBRDcBasketOracle public basketOracle;

    // --- Fração OURO (única com resgate físico em espécie) ---
    // Invariante de negócio: totalGoldReservesGrams deve refletir SOMENTE
    // ouro que a AIBANK custodia fisicamente e pode movimentar. Nunca um
    // número referenciado a reserva de terceiro.
    uint256 public totalGoldReservesGrams;
    uint256 public goldBackedSupply;

    struct CustodyRecord {
        bytes32 barSerialNumber;
        uint256 weightGrams;
        uint256 purity;
        string vaultLocation;      // cofre operado pela AIBANK (ou custodiante contratado por ela)
        uint256 depositedAt;
        bool isActive;
    }
    mapping(bytes32 => CustodyRecord) public custodyRecords;
    bytes32[] public activeBarSerials;

    struct GoldRedemptionRequest {
        address requester;
        uint256 amountGrams;
        uint256 requestedAt;
        bool processed;
        string deliveryAddress;
        uint256 feePaid;
    }
    mapping(uint256 => GoldRedemptionRequest) public goldRedemptionRequests;
    uint256 public goldRedemptionRequestCount;

    // --- Compliance / limites ---
    mapping(address => bool) public blacklisted;
    mapping(address => uint8) public kycTier;
    mapping(address => uint256) public dailyVolume;
    mapping(address => uint256) public lastVolumeReset;
    mapping(uint8 => uint256) public dailyLimits;

    event BasketOracleUpdated(address oldOracle, address newOracle);
    event GoldDeposited(bytes32 indexed barSerial, uint256 weightGrams, string vaultLocation);
    event GoldWithdrawn(bytes32 indexed barSerial, uint256 weightGrams, string reason);
    event TokensMinted(address indexed to, uint256 amount, uint256 navAtMint, bool goldBacked);
    event TokensBurned(address indexed from, uint256 amount, uint256 navAtBurn);
    event GoldRedemptionRequested(uint256 indexed requestId, address indexed requester, uint256 amountGrams);
    event GoldRedemptionProcessed(uint256 indexed requestId, address indexed requester, uint256 amountGrams, uint256 fee);
    event BlacklistUpdated(address indexed account, bool status);
    event KycUpdated(address indexed account, uint8 tier);
    event CustodyAudit(bytes32 indexed barSerial, uint256 verifiedWeight, uint256 timestamp);
    event EmergencyShutdown(string reason);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @param admin Endereço administrativo controlado pela AIBANK.
    /// @param _basketOracle Endereço do BRDcBasketOracle já implantado.
    function initialize(address admin, address _basketOracle) public initializer {
        __ERC20_init("BRDc Basket Index Token", "BRDc");
        __ERC20Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        _grantRole(CUSTODIAN_ROLE, admin);

        basketOracle = IBRDcBasketOracle(_basketOracle);

        dailyLimits[1] = 1000 * 10 ** 18;
        dailyLimits[2] = 10000 * 10 ** 18;
        dailyLimits[3] = type(uint256).max;
    }

    function setBasketOracle(address _newOracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newOracle != address(0), "BRDc: invalid oracle");
        address old = address(basketOracle);
        basketOracle = IBRDcBasketOracle(_newOracle);
        emit BasketOracleUpdated(old, _newOracle);
    }

    // ============================= CUSTODIA DE OURO (AIBANK) =============================
    // Único componente da cesta com lastro físico resgatável em espécie.
    // Cada barra aqui registrada precisa corresponder a ouro real, sob
    // custódia direta da AIBANK ou de custodiante por ela contratado
    // (ex.: cofre institucional) — nunca a um número de reserva de terceiro.

    function depositGold(
        bytes32 barSerialNumber,
        uint256 weightGrams,
        uint256 purity,
        string memory vaultLocation
    ) external onlyRole(CUSTODIAN_ROLE) {
        require(weightGrams > 0, "BRDc: invalid weight");
        require(purity >= 9900 && purity <= 9999, "BRDc: invalid purity");
        require(custodyRecords[barSerialNumber].depositedAt == 0, "BRDc: bar exists");

        custodyRecords[barSerialNumber] = CustodyRecord({
            barSerialNumber: barSerialNumber,
            weightGrams: weightGrams,
            purity: purity,
            vaultLocation: vaultLocation,
            depositedAt: block.timestamp,
            isActive: true
        });
        activeBarSerials.push(barSerialNumber);
        totalGoldReservesGrams += weightGrams;

        emit GoldDeposited(barSerialNumber, weightGrams, vaultLocation);
    }

    function withdrawGold(bytes32 barSerialNumber, string memory reason) external onlyRole(CUSTODIAN_ROLE) {
        CustodyRecord storage record = custodyRecords[barSerialNumber];
        require(record.isActive, "BRDc: bar not active");

        uint256 weight = record.weightGrams;
        record.isActive = false;
        record.weightGrams = 0;
        totalGoldReservesGrams -= weight;

        for (uint256 i = 0; i < activeBarSerials.length; i++) {
            if (activeBarSerials[i] == barSerialNumber) {
                activeBarSerials[i] = activeBarSerials[activeBarSerials.length - 1];
                activeBarSerials.pop();
                break;
            }
        }
        emit GoldWithdrawn(barSerialNumber, weight, reason);
    }

    function auditCustody(bytes32 barSerialNumber, uint256 verifiedWeight) external onlyRole(CUSTODIAN_ROLE) {
        CustodyRecord storage record = custodyRecords[barSerialNumber];
        require(record.isActive, "BRDc: bar not active");
        require(verifiedWeight == record.weightGrams, "BRDc: weight mismatch");
        emit CustodyAudit(barSerialNumber, verifiedWeight, block.timestamp);
    }

    // ============================= MINT / BURN =============================
    // O mint usa o NAV da CESTA INTEIRA (não só ouro) — é assim que o token
    // reflete a exposição a minérios/commodities. `goldBacked` é só um FLAG
    // contábil para saber quanto do supply pode, no agregado, disputar a
    // fila de resgate físico de ouro (ver requestGoldRedemption). Os
    // PRIMEIROS BRDc a mintar devem usar goldBacked=true SOMENTE até o
    // limite do que a AIBANK já tem em custódia própria (ver
    // totalGoldReservesGrams / getActiveBarsCount) — nunca além disso.

    function mint(
        address to,
        uint256 amount,
        bool goldBacked
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        require(to != address(0), "BRDc: mint to zero");
        require(amount > 0, "BRDc: zero amount");
        require(!blacklisted[to], "BRDc: recipient blacklisted");
        require(kycTier[to] > 0, "BRDc: KYC required");

        if (goldBacked) {
            require(goldBackedSupply + amount <= totalGoldReservesGrams, "BRDc: exceeds AIBANK gold custody");
        }

        uint256 nav = basketOracle.computeNAV(); // reverte se preço obsoleto — proposital

        if (goldBacked) {
            goldBackedSupply += amount;
        }

        _checkDailyLimit(to, amount);
        _mint(to, amount);

        emit TokensMinted(to, amount, nav, goldBacked);
    }

    function burn(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "BRDc: burn zero");
        require(balanceOf(msg.sender) >= amount, "BRDc: insufficient balance");

        uint256 nav = basketOracle.computeNAV();

        if (goldBackedSupply > 0) {
            uint256 reduction = amount > goldBackedSupply ? goldBackedSupply : amount;
            goldBackedSupply -= reduction;
        }

        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount, nav);
    }

    // ============================= RESGATE FÍSICO (SÓ OURO) =============================
    // Única via de resgate EM ESPÉCIE, sempre contra o ouro que a AIBANK
    // efetivamente custodia. Minérios/commodities nunca são entregues
    // fisicamente por este contrato — saída dessa exposição é via burn()
    // + liquidação em caixa/stablecoin fora deste contrato (BRDcReserve.sol).

    function requestGoldRedemption(
        uint256 amountGrams,
        string memory deliveryAddress
    ) external nonReentrant returns (uint256 requestId) {
        require(!blacklisted[msg.sender], "BRDc: blacklisted");
        require(amountGrams >= MIN_GOLD_REDEMPTION_GRAMS, "BRDc: below minimum");
        require(balanceOf(msg.sender) >= amountGrams, "BRDc: insufficient balance");
        require(goldBackedSupply >= amountGrams, "BRDc: insufficient gold-backed supply");
        require(totalGoldReservesGrams >= amountGrams, "BRDc: insufficient AIBANK gold reserve");
        require(bytes(deliveryAddress).length > 0, "BRDc: invalid address");

        uint256 fee = (amountGrams * REDEMPTION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netAmount = amountGrams - fee;

        _burn(msg.sender, amountGrams);
        goldBackedSupply -= amountGrams;
        totalGoldReservesGrams -= amountGrams;

        requestId = goldRedemptionRequestCount++;
        goldRedemptionRequests[requestId] = GoldRedemptionRequest({
            requester: msg.sender,
            amountGrams: netAmount,
            requestedAt: block.timestamp,
            processed: false,
            deliveryAddress: deliveryAddress,
            feePaid: fee
        });

        emit GoldRedemptionRequested(requestId, msg.sender, amountGrams);
    }

    function processGoldRedemption(uint256 requestId) external onlyRole(CUSTODIAN_ROLE) nonReentrant {
        GoldRedemptionRequest storage request = goldRedemptionRequests[requestId];
        require(!request.processed, "BRDc: already processed");
        request.processed = true;
        emit GoldRedemptionProcessed(requestId, request.requester, request.amountGrams, request.feePaid);
    }

    // ============================= COMPLIANCE =============================

    function setBlacklist(address account, bool status) external onlyRole(COMPLIANCE_ROLE) {
        blacklisted[account] = status;
        emit BlacklistUpdated(account, status);
    }

    function setKycTier(address account, uint8 tier) external onlyRole(COMPLIANCE_ROLE) {
        require(tier <= 3, "BRDc: invalid tier");
        kycTier[account] = tier;
        emit KycUpdated(account, tier);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyShutdown("emergency pause");
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20PausableUpgradeable)
    {
        if (from != address(0)) require(!blacklisted[from], "BRDc: sender blacklisted");
        if (to != address(0)) require(!blacklisted[to], "BRDc: recipient blacklisted");
        super._update(from, to, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function decimals() public pure override returns (uint8) {
        return TOKEN_DECIMALS;
    }

    // ============================= VIEWS =============================

    function getActiveBarsCount() external view returns (uint256) {
        return activeBarSerials.length;
    }

    function getCurrentNAV() external view returns (uint256) {
        return basketOracle.computeNAV();
    }

    /// @notice Fração do supply total coberta por ouro físico da AIBANK, resgatável.
    function getGoldBackedRatio() external view returns (uint256 ratioBps) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return (goldBackedSupply * BPS_DENOMINATOR) / supply;
    }

    function isGoldPortionFullyBacked() external view returns (bool) {
        return totalGoldReservesGrams >= goldBackedSupply;
    }

    function _checkDailyLimit(address account, uint256 amount) internal {
        uint8 tier = kycTier[account];
        if (tier == 0) revert("BRDc: KYC required");
        uint256 limit = dailyLimits[tier];
        if (limit == type(uint256).max) return;
        if (block.timestamp > lastVolumeReset[account] + 1 days) {
            dailyVolume[account] = 0;
            lastVolumeReset[account] = block.timestamp;
        }
        require(dailyVolume[account] + amount <= limit, "BRDc: daily limit exceeded");
        dailyVolume[account] += amount;
    }
}
