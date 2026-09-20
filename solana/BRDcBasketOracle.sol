// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BRDcBasketOracle
 * @notice Calcula o NAV (Net Asset Value) por token BRDc a partir de uma
 * cesta ponderada de ativos: ouro (com feed Chainlink confiável) + minérios
 * e commodities brasileiras (sem feed Chainlink direto e confiável na
 * maioria dos casos — ver nota abaixo).
 *
 * DECISÃO DE DESIGN (resultado da conversa sobre o modelo de lastro):
 * o ouro é resgatável fisicamente (ver BRDcToken.requestGoldRedemption).
 * Minérios e commodities NÃO são resgatáveis em espécie — eles só
 * influenciam o NAV do token, como um índice. Isso é o que torna a
 * arquitetura operacionalmente viável: não existe "barra de minério de
 * ferro no cofre" resgatável 1:1 da forma como existe para ouro.
 *
 * NOTA HONESTA SOBRE FONTES DE PREÇO:
 * Ouro (XAU/USD) tem feed Chainlink líquido e confiável. Minério de ferro,
 * soja, café e a maioria das commodities agrícolas brasileiras NÃO têm
 * feed Chainlink direto e amplamente confiável na maioria das redes
 * (isso pode mudar — confira o Chainlink Feed Registry antes de ir a
 * produção). Para essas, este contrato usa um preço "administrado"
 * (PRICE_UPDATER_ROLE) com timestamp e trilha de auditoria on-chain —
 * o que significa CONFIANÇA NO OPERADOR para esses componentes da cesta,
 * não trustlessness total. Isso deve estar em letras claras em qualquer
 * material de divulgação: a parcela não-ouro do lastro depende de um
 * processo administrado, auditável, mas não é feed descentralizado.
 * Antes de produção, avalie oráculos especializados em RWA/commodities
 * (ex.: Chainlink Data Streams, Pyth, ou um comitê multi-sig de preço)
 * em vez de uma única EOA/role atualizando manualmente.
 */
contract BRDcBasketOracle is AccessControl {
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    bytes32 public constant BASKET_MANAGER_ROLE = keccak256("BASKET_MANAGER_ROLE");

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_STALENESS = 6 hours;
    uint256 public constant PRICE_PRECISION = 1e8; // padrão Chainlink (8 casas decimais)

    enum PriceSource { CHAINLINK, MANUAL }

    struct Asset {
        bytes32 id;                 // ex: keccak256("XAU"), keccak256("IRON_ORE"), keccak256("SOYBEAN")
        string symbol;               // "XAU", "IRON_ORE", "SOYBEAN", "COFFEE" ...
        uint256 weightBps;           // peso na cesta, em basis points (soma deve ser 10000)
        PriceSource source;
        AggregatorV3Interface chainlinkFeed; // usado se source == CHAINLINK
        uint256 manualPrice;         // usado se source == MANUAL (PRICE_PRECISION)
        uint256 lastManualUpdate;
        bool active;
    }

    bytes32[] public assetIds;
    mapping(bytes32 => Asset) public assets;
    uint256 public totalWeightBps;

    event AssetAdded(bytes32 indexed id, string symbol, uint256 weightBps, PriceSource source);
    event AssetWeightUpdated(bytes32 indexed id, uint256 oldWeightBps, uint256 newWeightBps);
    event AssetDeactivated(bytes32 indexed id);
    event ManualPriceUpdated(bytes32 indexed id, uint256 oldPrice, uint256 newPrice, uint256 timestamp);
    event NAVComputed(uint256 navPerUnit, uint256 timestamp);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PRICE_UPDATER_ROLE, admin);
        _grantRole(BASKET_MANAGER_ROLE, admin);
    }

    /// @notice Adiciona um ativo à cesta. A soma dos pesos deve fechar em 10000 bps (100%).
    function addAsset(
        string calldata symbol,
        uint256 weightBps,
        PriceSource source,
        address chainlinkFeed
    ) external onlyRole(BASKET_MANAGER_ROLE) {
        bytes32 id = keccak256(abi.encodePacked(symbol));
        require(!assets[id].active, "Basket: asset exists");
        require(weightBps > 0 && weightBps <= BASIS_POINTS, "Basket: invalid weight");
        require(totalWeightBps + weightBps <= BASIS_POINTS, "Basket: exceeds 100%");
        if (source == PriceSource.CHAINLINK) {
            require(chainlinkFeed != address(0), "Basket: feed required");
        }

        assets[id] = Asset({
            id: id,
            symbol: symbol,
            weightBps: weightBps,
            source: source,
            chainlinkFeed: AggregatorV3Interface(chainlinkFeed),
            manualPrice: 0,
            lastManualUpdate: 0,
            active: true
        });
        assetIds.push(id);
        totalWeightBps += weightBps;

        emit AssetAdded(id, symbol, weightBps, source);
    }

    /// @notice Reponderação da cesta — decisão de governança/negócio, não do modelo estatístico.
    function updateAssetWeight(string calldata symbol, uint256 newWeightBps) external onlyRole(BASKET_MANAGER_ROLE) {
        bytes32 id = keccak256(abi.encodePacked(symbol));
        Asset storage asset = assets[id];
        require(asset.active, "Basket: asset not active");

        uint256 oldWeight = asset.weightBps;
        require(totalWeightBps - oldWeight + newWeightBps <= BASIS_POINTS, "Basket: exceeds 100%");

        asset.weightBps = newWeightBps;
        totalWeightBps = totalWeightBps - oldWeight + newWeightBps;

        emit AssetWeightUpdated(id, oldWeight, newWeightBps);
    }

    function deactivateAsset(string calldata symbol) external onlyRole(BASKET_MANAGER_ROLE) {
        bytes32 id = keccak256(abi.encodePacked(symbol));
        Asset storage asset = assets[id];
        require(asset.active, "Basket: already inactive");
        totalWeightBps -= asset.weightBps;
        asset.active = false;
        emit AssetDeactivated(id);
    }

    /// @notice Atualiza o preço administrado de um ativo sem feed Chainlink confiável.
    function setManualPrice(string calldata symbol, uint256 price) external onlyRole(PRICE_UPDATER_ROLE) {
        bytes32 id = keccak256(abi.encodePacked(symbol));
        Asset storage asset = assets[id];
        require(asset.active, "Basket: asset not active");
        require(asset.source == PriceSource.MANUAL, "Basket: asset uses Chainlink");
        require(price > 0, "Basket: invalid price");

        uint256 old = asset.manualPrice;
        asset.manualPrice = price;
        asset.lastManualUpdate = block.timestamp;

        emit ManualPriceUpdated(id, old, price, block.timestamp);
    }

    /// @notice Preço atual de um ativo específico da cesta, em USD (8 casas decimais).
    function getAssetPrice(bytes32 id) public view returns (uint256 price, bool isStale) {
        Asset storage asset = assets[id];
        require(asset.active, "Basket: asset not active");

        if (asset.source == PriceSource.CHAINLINK) {
            (, int256 answer, , uint256 updatedAt, ) = asset.chainlinkFeed.latestRoundData();
            if (answer <= 0) return (0, true);
            isStale = (block.timestamp - updatedAt) > MAX_STALENESS;
            return (uint256(answer), isStale);
        } else {
            isStale = (block.timestamp - asset.lastManualUpdate) > MAX_STALENESS;
            return (asset.manualPrice, isStale);
        }
    }

    /**
     * @notice NAV agregado da cesta (soma ponderada dos preços dos ativos ativos).
     * @dev Reverte se QUALQUER ativo ativo estiver com preço obsoleto — isso é
     * proposital: preferimos travar a operação a calcular um NAV parcialmente
     * obsoleto e deixar alguém mintar/resgatar com preço errado.
     */
    function computeNAV() public view returns (uint256 navUsd8Decimals) {
        require(totalWeightBps == BASIS_POINTS, "Basket: weights do not sum to 100%");

        uint256 weightedSum = 0;
        for (uint256 i = 0; i < assetIds.length; i++) {
            Asset storage asset = assets[assetIds[i]];
            if (!asset.active) continue;

            (uint256 price, bool isStale) = getAssetPrice(asset.id);
            require(!isStale, "Basket: stale price blocks NAV computation");
            require(price > 0, "Basket: zero price blocks NAV computation");

            weightedSum += (price * asset.weightBps) / BASIS_POINTS;
        }
        return weightedSum;
    }

    function getBasketComposition() external view returns (
        string[] memory symbols,
        uint256[] memory weights,
        bool[] memory activeFlags
    ) {
        uint256 n = assetIds.length;
        symbols = new string[](n);
        weights = new uint256[](n);
        activeFlags = new bool[](n);
        for (uint256 i = 0; i < n; i++) {
            Asset storage asset = assets[assetIds[i]];
            symbols[i] = asset.symbol;
            weights[i] = asset.weightBps;
            activeFlags[i] = asset.active;
        }
    }
}
