const path = require("path");
const fs = require("fs");
const solc = require("solc");

const CONTRACTS_TO_COMPILE = [
  "contracts/interfaces/IBRDcBasketOracle.sol",
  "contracts/oracle/BRDcBasketOracle.sol",
  "contracts/token/BRDcToken.sol",
  "contracts/reserve/BRDcReserve.sol",
  "contracts/governance/BRDcGovernance.sol",
];

function findImports(importPath) {
  const candidates = [
    path.resolve(__dirname, importPath),
    path.resolve(__dirname, "node_modules", importPath),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return { contents: fs.readFileSync(c, "utf8") };
    }
  }
  return { error: `File not found: ${importPath}` };
}

const sources = {};
for (const file of CONTRACTS_TO_COMPILE) {
  sources[file] = { content: fs.readFileSync(path.resolve(__dirname, file), "utf8") };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
    },
  },
};

console.log("Compilando com solc", solc.version());
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

let hasError = false;
if (output.errors) {
  for (const err of output.errors) {
    const isWarning = err.severity === "warning";
    console.log(`\n[${err.severity.toUpperCase()}] ${err.formattedMessage}`);
    if (!isWarning) hasError = true;
  }
}

if (!hasError) {
  console.log("\n✅ COMPILAÇÃO OK — sem erros.");
  for (const file of Object.keys(output.contracts || {})) {
    for (const contractName of Object.keys(output.contracts[file])) {
      const bytecodeLen = output.contracts[file][contractName].evm.bytecode.object.length / 2;
      console.log(`  - ${contractName}: bytecode ${bytecodeLen} bytes`);
    }
  }
  fs.mkdirSync(path.resolve(__dirname, "build-check"), { recursive: true });
  fs.writeFileSync(
    path.resolve(__dirname, "build-check/output.json"),
    JSON.stringify(output, null, 2)
  );
} else {
  console.log("\n❌ COMPILAÇÃO FALHOU.");
  process.exit(1);
}
