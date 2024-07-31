import { parseUnits } from "ethers/lib/utils";
import { useTradeExactIn, useTradeExactOut } from "hooks/trades";
import { JSBI, Token, TokenAmount, Trade } from "l0k_swap-sdk";
import { AccountInterface, Contract, RpcProvider } from "starknet";
import PairAbi from "../abis/Pair.json";
import RouterAbi from "../abis/Router.json";
import { APP_CHAIN_ID, Field, ROUTER_ADDRESS } from "../configs";

// try to parse a user entered amount for a given token
export const tryParseAmount = (
  value: string,
  currency: Token | undefined
): TokenAmount | undefined => {
  if (!value || !currency) {
    return undefined;
  }
  try {
    const typedValueParsed = parseUnits(value, currency.decimals).toString();
    if (typedValueParsed !== "0") {
      return new TokenAmount(currency, JSBI.BigInt(typedValueParsed));
    }
  } catch (error) {
    // should fail if the user specifies too many decimal places of precision (or maybe exceed max uint?)
    console.debug(`Failed to parse input amount: "${value}"`, error);
  }
  // necessary for all paths to return a value
  return undefined;
};

// from the current swap inputs, compute the best trade and return it.
export const useDerivedSwapInfo = async ({
  library,
  independentField = Field.INPUT,
  typedValue,
  tokens,
  singlehops,
}: {
  library: AccountInterface | RpcProvider;
  independentField: Field;
  typedValue: string | BigInt;
  tokens: {
    [key in Field]: Token | undefined;
  };
  singlehops: boolean;
}): Promise<Trade | null | undefined> => {
  if (!library) return null;
  const { [Field.INPUT]: inputCurrency, [Field.OUTPUT]: outputCurrency } =
    tokens;
  if (!inputCurrency || !outputCurrency) return null;

  const isExactIn = independentField === Field.INPUT;
  const parsedAmount = tryParseAmount(
    typedValue.toString(),
    (isExactIn ? inputCurrency : outputCurrency) ?? undefined
  );
  // if (!parsedAmount) return null;

  const [bestTradeExactIn, bestTradeExactOut] = await Promise.all([
    useTradeExactIn(library, parsedAmount, outputCurrency),
    useTradeExactOut(library, inputCurrency, parsedAmount),
  ]);

  const trade = isExactIn ? bestTradeExactIn : bestTradeExactOut;

  return trade;
};

export const swapCallback = async (
  library: AccountInterface | null | undefined,
  account: string | null | undefined, // the ENS name or address of the recipient of the trade, or null if swap should be returned to sender,
  trade: Trade | null | undefined, // trade to execute, required
  allowedSlippage: number
) => {
  try {
    if (!library || !account || !trade || isNaN(allowedSlippage)) return;

    // const routerContract = getRouterContract(library, account);
    const deadline = Math.floor(Date.now() / 1000) + 30 * 60;

    // // swapCalls arguments
    // const swapCalls = await getSwapCallArguments(
    //   account,
    //   deadline,
    //   Math.floor(allowedSlippage * 100),
    //   routerContract,
    //   trade
    // );

    // if (!trade || !account || !swapCalls?.length || !routerContract) return;

    // let {
    //   parameters: { methodName, args, value },
    // } = swapCalls[0];

    // swapExactETHForTokens ETH -> Token
    // swapExactTokensForETH Token -> ETH

    // const params = {
    //   from: account,
    //   to: routerAddress,
    //   data,
    //   value, // = 0 if Token -> ETH
    //   // gasPrice: '0x01',
    //   // gasLimit,
    // };

    // let options = { value };
    // const { gasLimit } = await estimateGas(
    //   routerContract,
    //   methodName,
    //   args,
    //   options
    // );
    // options = {
    //   ...options,
    //   gasLimit,
    // };
    // console.log(methodName, args, options);
    // return callContract(routerContract, methodName, args, options);

    const approveCall = new Contract(
      PairAbi,
      trade.inputAmount.token.address,
      library
    ).populate("approve", {
      spender: ROUTER_ADDRESS[APP_CHAIN_ID],
      amount: trade.inputAmount.raw.toString(),
    });

    const swapCall = new Contract(
      RouterAbi,
      ROUTER_ADDRESS[APP_CHAIN_ID],
      library
    ).populate("swap_exact_tokens_for_tokens", {
      amountIn: trade.inputAmount.raw.toString(),
      amountOutMin: "0",
      // trade.inputAmount.raw.toString(),
      path: [
        {
          tokenIn: trade.route.path[0].address,
          tokenOut: trade.route.path[1].address,
        },
      ],
      to: library.address,
      deadline,
    });

    const tx = await library.execute([approveCall, swapCall]);
    await library.waitForTransaction(tx.transaction_hash);
    return tx;
  } catch (error) {
    console.error("user reject transaction", error);
    throw error;
  }
};
