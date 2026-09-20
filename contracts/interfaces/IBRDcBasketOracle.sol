// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBRDcBasketOracle
 * @notice Interface mínima que o BRDcToken precisa do oráculo de cesta.
 * Mantida separada da implementação (BRDcBasketOracle.sol) para permitir
 * trocar a fonte de NAV (ex.: migrar de preço administrado para um
 * provedor especializado em RWA/commodities) sem alterar o token.
 */
interface IBRDcBasketOracle {
    function computeNAV() external view returns (uint256 navUsd8Decimals);
}
