import { Provider, utils } from "zksync-web3";
import * as ethers from "ethers";

// Put the address of the deployed paymaster here
const PAYMASTER_ADDRESS = "0xF3dd373AC0e70A2BE6DE75f1ED0268fe856a2A6F";

// Put the address of the ERC20 token here:
const TOKEN_ADDRESS = "0x3FdA662964cC0d12690bedbc073CD6C4dB83E77f";

// Wallet private key
const EMPTY_WALLET_PRIVATE_KEY = "0x9ce467ba3d3889939fcbe6ffd58b482557f86b67f925a808d691d0905d8f2924";

function getToken(hre, wallet) {
  const artifact = hre.artifacts.readArtifactSync("MyERC20");
  return new ethers.Contract(TOKEN_ADDRESS, artifact.abi, wallet);
}

export default async function (hre) {
  const provider = new Provider("https://testnet.era.zksync.dev");
  const emptyWallet = new Wallet(EMPTY_WALLET_PRIVATE_KEY, provider);

  // const paymasterWallet = new Wallet(PAYMASTER_ADDRESS, provider);
  // Obviously this step is not required, but it is here purely to demonstrate that indeed the wallet has no ether.
  const ethBalance = await emptyWallet.getBalance();
  if (!ethBalance.eq(0)) {
    throw new Error("The wallet is not empty!");
  }

  console.log(
    `ERC20 token balance of the empty wallet before mint: ${await emptyWallet.getBalance(
      TOKEN_ADDRESS
    )}`
  );

  let paymasterBalance = await provider.getBalance(PAYMASTER_ADDRESS);
  console.log(`Paymaster ETH balance is ${paymasterBalance.toString()}`);

  const erc20 = getToken(hre, emptyWallet);

  const gasPrice = await provider.getGasPrice();

  // Encoding the "ApprovalBased" paymaster flow's input
  const paymasterParams = utils.getPaymasterParams(PAYMASTER_ADDRESS, {
    type: "ApprovalBased",
    token: TOKEN_ADDRESS,
    // set minimalAllowance as we defined in the paymaster contract
    minimalAllowance: ethers.BigNumber.from(1),
    // empty bytes as testnet paymaster does not use innerInput
    innerInput: new Uint8Array(),
  });

  // Estimate gas fee for mint transaction
  const gasLimit = await erc20.estimateGas.mint(emptyWallet.address, 5, {
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      paymasterParams: paymasterParams,
    },
  });

  const fee = gasPrice.mul(gasLimit.toString());
  console.log("Transaction fee estimation is :>> ", fee.toString());

  console.log(`Minting 5 tokens for empty wallet via paymaster...`);
  await (
    await erc20.mint(emptyWallet.address, 5, {
      // paymaster info
      customData: {
        paymasterParams: paymasterParams,
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      },
    })
  ).wait();

  console.log(
    `Paymaster ERC20 token balance is now ${await erc20.balanceOf(
      PAYMASTER_ADDRESS
    )}`
  );

  paymasterBalance = await provider.getBalance(PAYMASTER_ADDRESS);
  console.log(`Paymaster ETH balance is now ${paymasterBalance.toString()}`);

  console.log(
    `ERC20 token balance of the empty wallet after mint: ${await emptyWallet.getBalance(
      TOKEN_ADDRESS
    )}`
  );
}