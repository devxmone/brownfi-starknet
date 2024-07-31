import { useAccount } from "@starknet-react/core";
import { Divider, Input, Slider, Typography } from "antd";
import BigNumber from "bignumber.js";
import ConfirmAddLP from "components/confirm-addliquidity-modal/ConfirmAddLPModal";
import ConfirmRemoveModal from "components/confirm-remove-modal/ConfirmRemoveModal";
import {
  APP_CHAIN_ID,
  Field,
  ROUTER_ADDRESS,
  SN_RPC_PROVIDER,
  TOKEN_LIST,
  getTokenIcon,
} from "configs";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { useGetBalance } from "hooks";
import { Fraction, Token, TokenAmount } from "l0k_swap-sdk";
import { ArrowDown } from "pages/swap/components/SwapPage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Contract, num } from "starknet";
import {
  PoolState,
  addLiquidityCallback,
  approveTokenLqCallback,
  getAllPairLength,
  getPoolInfo,
  removeLiquidityCallback,
} from "state/liquidity";
import { useWeb3Store } from "stores/web3";
import useSWR from "swr";
import { twMerge } from "tailwind-merge";
import PairAbi from "../../../abis/Pair.json";
import SettingParameter from "../../../components/settings-parameter/SettingParameter";
import { ArrowBack, HelpIcon } from "../../liquidity/components/icons";
import { ActiveIcon } from "../../pool/components/icons";
import { mockPools } from "../../pool/components/Pools";
import { FilterIcon } from "./icons";
import SelectTokenModal from "components/select-token-modal/SelectTokenModal";

export const PROCESS_REMOVE = {
  LOADING: "LOADING",
  SUCCESS: "SUCCESS",
  FAIL: "FAIL",
};

const YourPool = () => {
  const { pairAddress } = useParams();
  const provider = SN_RPC_PROVIDER();
  const { account, address, isConnected } = useAccount();
  const web3State = useWeb3Store();
  const txHash = useWeb3Store();

  const [tokens, setTokens] = useState<{
    [key in Field]: Token | undefined;
  }>({
    [Field.INPUT]: TOKEN_LIST[APP_CHAIN_ID][0],
    [Field.OUTPUT]: TOKEN_LIST[APP_CHAIN_ID][1],
  });
  const [tokenAmounts, setTokenAmounts] = useState<{ [key in Field]: string }>({
    [Field.INPUT]: "",
    [Field.OUTPUT]: "",
  });
  const [parsedTokenAmounts, setParsedTokenAmounts] = useState<{
    [key in Field]: TokenAmount | undefined;
  }>({
    [Field.INPUT]: undefined,
    [Field.OUTPUT]: undefined,
  });
  const [processRemove, setProcessRemove] = useState<string>(
    PROCESS_REMOVE.LOADING
  );
  const [tab, setTab] = useState<Tab>("view");
  const [isShowSetting, setIsShowSetting] = useState<boolean>(false);
  const [isShowConfirm, setIsShowConfirm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [disabled, setDisabled] = useState(true);
  const [k, setK] = useState<number>(1);
  const [percent, setPercent] = useState<number>(0);

  const onChangeK = (newValue: number) => {
    setK(newValue);
  };

  const [isShowReviewModal, setIsShowReviewModal] = useState<boolean>(false);
  const [isShowTokenModal, setIsShowTokenModal] = useState<boolean>(false);
  const [typeModal, setTypeModal] = useState<number>(1);
  const [token0InputAmount, setToken0InputAmount] = useState(0);
  const [token1OutputAmount, setToken1OutputAmount] = useState<any>(0);
  const [independentField, setIndependentField] = useState<Field>(Field.INPUT);
  const [allowanceLq, setAllowanceLq] = useState<BigNumber>();
  const [approveTx, setApproveTx] = useState<string | undefined>(undefined);
  const [isApprove, setIsApprove] = useState<boolean>(false);
  const [checkApprove, setCheckApprove] = useState<boolean>(false);

  const { data } = useSWR<{
    balances: (TokenAmount | undefined)[];
    poolInfo: PoolState | undefined;
    allPairLength: number | undefined;
  }>([address, tokens[Field.INPUT], tokens[Field.OUTPUT]], async () => {
    // if (!address || !isConnected) {
    //   return {
    // 		balances: [],
    // 		poolInfo: undefined,
    // 	};
    // }
    const provider = SN_RPC_PROVIDER();
    const balances = await Promise.all(
      [tokens[Field.INPUT], tokens[Field.OUTPUT]].map(async (t) => {
        if (!address || !t) return undefined;
        const res = await provider.callContract({
          contractAddress: t.address,
          entrypoint: "balanceOf",
          calldata: [address],
        });
        return new TokenAmount(t, num.hexToDecimalString(res.result[0]));
      })
    );

    const poolInfo = await getPoolInfo(address, provider, [
      tokens[Field.INPUT],
      tokens[Field.OUTPUT],
    ]);

    const allPairLength = await getAllPairLength(provider);

    return {
      balances,
      poolInfo,
      allPairLength,
    };
  });

  const data1 = mockPools()[0];

  const handleChangeAmounts = useCallback(
    (value: string, independentField: Field) => {
      if (!data?.poolInfo) return;

      if (value === "") {
        data.poolInfo.noLiquidity
          ? setTokenAmounts((amounts) => ({
              ...amounts,
              [independentField]: "",
            }))
          : setTokenAmounts({
              [Field.INPUT]: "",
              [Field.OUTPUT]: "",
            });
        return;
      }

      setIndependentField(independentField);
      const remainField =
        independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT;
      const decimalsIndependent = tokens?.[independentField]?.decimals ?? 18;
      const remainDecimals = tokens?.[remainField]?.decimals ?? 18;
      let parsedAmount: Fraction | undefined;
      if (
        data.poolInfo.noLiquidity &&
        !data.poolInfo.prices[independentField]
      ) {
        setTokenAmounts((amounts) => ({
          ...amounts,
          [independentField]: value,
        }));
        try {
          parsedAmount = new Fraction(
            parseUnits(value, decimalsIndependent).toString()
          );
          tokens[independentField] &&
            setParsedTokenAmounts((amounts) => ({
              ...amounts,
              [independentField]: new TokenAmount(
                tokens[independentField] as any,
                parsedAmount?.quotient.toString() as any
              ),
            }));
        } catch (error) {
          console.error(error);
          return;
        }
      } else {
        try {
          parsedAmount = new Fraction(
            parseUnits(value, decimalsIndependent).toString()
          );
        } catch (error) {
          console.error(error);
          return;
        }
        if (!parsedAmount) return;

        const isTokenA0 = tokens[independentField]?.symbol === "ETH";

        const remainParsedAmount = parsedAmount.multiply(
          data?.poolInfo.prices[isTokenA0 ? independentField : remainField]
            ?.raw ?? "1"
        );

        setParsedTokenAmounts({
          [independentField]: new TokenAmount(
            tokens[independentField] as any,
            parsedAmount.quotient.toString()
          ),
          [remainField]: new TokenAmount(
            tokens[remainField] as any,
            remainParsedAmount.quotient.toString()
          ),
        } as any);
        setTokenAmounts({
          [independentField]: value,
          [remainField]: formatUnits(
            remainParsedAmount.quotient.toString(),
            remainDecimals
          ),
        } as any);
      }
    },
    [data?.poolInfo, tokens[Field.INPUT], tokens[Field.OUTPUT]]
  );

  if (!data) return;

  useEffect(() => {
    const getAllowance = async () => {
      if (data?.poolInfo?.pairAddress && address) {
        const tokenContract = new Contract(
          PairAbi,
          data?.poolInfo?.pairAddress || "",
          account
        );
        const res = await tokenContract.call("allowance", [
          address,
          ROUTER_ADDRESS[APP_CHAIN_ID],
        ]);
        setAllowanceLq(new BigNumber(res.toString()));
      }
    };
    getAllowance();
  }, [address, data?.poolInfo?.pairAddress, txHash]);

  const lqBalanceRemove = useGetBalance(
    provider,
    address,
    data?.poolInfo?.pairAddress
  );

  const onChangePercent = (newValue: number) => {
    setPercent(newValue);
    const lpBalance = new BigNumber(lqBalanceRemove)
      .multipliedBy(newValue)
      .dividedBy(100);
    if (allowanceLq && new BigNumber(lpBalance).isLessThan(allowanceLq)) {
      setCheckApprove(true);
    } else {
      setCheckApprove(false);
    }
  };

  const reserve0Persent = new BigNumber(
    data?.poolInfo?.pair?.reserve0?.raw.toString() || 0
  )
    .multipliedBy(percent)
    .dividedBy(new BigNumber(10).pow(18).multipliedBy(100));

  const reserve1Persent = new BigNumber(
    data?.poolInfo?.pair?.reserve1?.raw.toString() || 0
  )
    .multipliedBy(percent)
    .dividedBy(new BigNumber(10).pow(18).multipliedBy(100));

  const lpBalance = new BigNumber(lqBalanceRemove)
    .multipliedBy(percent)
    .dividedBy(100)
    .decimalPlaces(0);

  const onApproveTokenCallback = useCallback(async () => {
    try {
      setIsApprove(true);
      const tx = await approveTokenLqCallback(
        address,
        account,
        data?.poolInfo?.pairAddress || "",
        lpBalance?.toString()
      );
      setApproveTx(tx);
      setIsApprove(false);
      setCheckApprove(true);
    } catch (error) {
      console.error(error);
      setIsApprove(false);
    }
  }, [address, account, data, lqBalanceRemove]);

  const removeLiquidity = useCallback(async () => {
    try {
      setIsShowConfirm(true);
      setProcessRemove(PROCESS_REMOVE.LOADING);
      const tx = await removeLiquidityCallback(
        address,
        account,
        tokens,
        lpBalance?.toString()
      );
      setProcessRemove(PROCESS_REMOVE.SUCCESS);
      useWeb3Store.setState({
        ...web3State,
        txHash: tx.transaction_hash,
      });
    } catch (error) {
      console.error(error);
      setProcessRemove(PROCESS_REMOVE.FAIL);
    }
  }, [address, account, tokens, reserve1Persent]);

  const onAddLiquidityCallback = useCallback(async () => {
    try {
      setSubmitting(true);
      const tx = await addLiquidityCallback(
        address,
        account,
        tokens,
        parsedTokenAmounts
      );
      setSubmitting(false);
      setTokenAmounts({
        [Field.INPUT]: "",
        [Field.OUTPUT]: "",
      });
      setApproveTx("");
      useWeb3Store.setState({
        ...web3State,
        txHash: tx.transaction_hash,
      });
    } catch (error) {
      console.error(error);
      setSubmitting(false);
    }
  }, [address, account, tokens, parsedTokenAmounts]);

  return (
    <div className="flex flex-col items-start">
      <div className="flex w-[500px] flex-col items-end justify-center bg-[#1D1C21] gap-8 p-8">
        <div className="flex flex-col items-start self-stretch gap-6">
          <div className="flex flex-col items-start gap-[10px] self-stretch">
            {tab === "view" ? (
              <Link
                to="/pools"
                className="flex items-center self-stretch gap-3 hover:text-white"
              >
                <ArrowBack />
                <span className="text-2xl !font-['Russo_One'] leading-[29px]">
                  {tab === "view" && "Back to Pools"}
                </span>
              </Link>
            ) : (
              <div
                onClick={() => setTab("view")}
                className="flex items-center self-stretch gap-3 cursor-pointer hover:text-white"
              >
                <ArrowBack />
                <span className="text-2xl !font-['Russo_One'] leading-[29px]">
                  {tab === "add" && "Add More Liquidity"}
                  {tab === "remove" && "Remove Liquidity"}
                </span>
              </div>
            )}
          </div>
          <div
            className={twMerge(
              "flex flex-col items-start gap-6 self-stretch",
              tab === "remove" && "hidden"
            )}
          >
            <div className="flex flex-col items-start self-stretch gap-4">
              <div className="flex items-center self-stretch justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-start">
                    <img
                      src={getTokenIcon(data?.poolInfo?.pair?.token0.address)}
                      alt=""
                      className="w-5 h-5"
                    />
                    <img
                      src={getTokenIcon(data?.poolInfo?.pair?.token1.address)}
                      alt=""
                      className="ml-[-8px] w-5 h-5"
                    />
                  </div>
                  <Typography className="text-base font-medium">
                    {data?.poolInfo?.pair?.token0.name}/
                    {data?.poolInfo?.pair?.token1.name}
                  </Typography>
                  <div
                    className={twMerge(
                      "flex py-[2px] px-3 items-center gap-1 w-[74px]",
                      data1.status === "Active" && "bg-[rgba(39,227,159,0.10)]",
                      data1.status === "Close" && "bg-[rgba(255,59,106,0.10)]"
                    )}
                  >
                    {data1.status === "Active" ? (
                      <ActiveIcon color="#27E39F" />
                    ) : (
                      <ActiveIcon color="#FF3B6A" />
                    )}
                    <Typography
                      className={twMerge(
                        "text-xs font-medium leading-[18px]",
                        data1.status === "Active" && "#27E39F",
                        data1.status === "Close" && "#FF3B6A"
                      )}
                    >
                      {data1.status}
                    </Typography>
                  </div>
                </div>
                <div
                  className={twMerge(
                    "flex h-6 px-4 justify-center items-center gap-[10px] bg-[#773030] cursor-pointer",
                    data1.status === "Close" && "hidden"
                  )}
                  onClick={() => setTab("remove")}
                >
                  <Typography className="text-xs font-bold leading-[15px]">
                    Remove
                  </Typography>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm font-medium">
                <div className="flex flex-col items-start gap-[6px]">
                  <Typography>Parameter:</Typography>
                  <Typography>Current LP price:</Typography>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-start gap-[6px]">
                    <div className="flex flex-col px-2 items-start gap-[10px] bg-[#131216]">
                      <Typography>{data1.parameter}</Typography>
                    </div>
                    <Typography>
                      {" "}
                      {data?.poolInfo?.pair?.token0Price.toFixed(2)}
                    </Typography>
                  </div>
                  <FilterIcon onClick={() => setIsShowSetting(true)} />
                </div>
              </div>
            </div>
            <div
              className={twMerge(
                "flex flex-col items-start gap-2 self-stretch",
                tab !== "view" && "hidden"
              )}
            >
              <div className="flex flex-col py-4 px-5 items-start gap-3 self-stretch bg-[#323038]">
                <div className="flex items-center self-stretch justify-between w-full">
                  <Typography className="text-base font-medium">
                    Liquidity
                  </Typography>
                  {/* <div
                    className="flex h-6 px-4 justify-center items-center gap-1 bg-[#1E1E1E] cursor-pointer"
                    onClick={() => setTab("add")}
                  >
                    <Typography className="text-xs font-bold leading-[15px]">
                      Increase liquidity
                    </Typography>
                  </div> */}
                </div>
                <Typography className="text-[32px] font-semibold">
                  {data1.status === "Close" ? "--" : "--"}
                </Typography>
                <div className="flex flex-col items-start self-stretch gap-1 text-sm font-medium">
                  <div className="flex items-center self-stretch justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={getTokenIcon(data?.poolInfo?.pair?.token0.address)}
                        alt=""
                        className="w-5 h-5"
                      />
                      <Typography>
                        {data?.poolInfo?.pair?.token0.name}
                      </Typography>
                    </div>
                    <div className="flex items-center gap-6">
                      {data1.status === "Close" ? (
                        <Typography>0</Typography>
                      ) : (
                        <>
                          <Typography>
                            {Number(
                              data?.poolInfo?.pair?.reserve0.raw.toString()
                            ) /
                              10 ** 18}
                          </Typography>
                          <Typography>--</Typography>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start self-stretch gap-1 text-sm font-medium">
                  <div className="flex items-center self-stretch justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={getTokenIcon(data?.poolInfo?.pair?.token1.address)}
                        alt=""
                        className="w-5 h-5"
                      />
                      <Typography>
                        {data?.poolInfo?.pair?.token1.name}
                      </Typography>
                    </div>
                    <div className="flex items-center gap-6">
                      {data1.status === "Close" ? (
                        <Typography>0</Typography>
                      ) : (
                        <>
                          <Typography>
                            {Number(
                              data?.poolInfo?.pair?.reserve1.raw.toString()
                            ) /
                              10 ** 18}
                          </Typography>
                          <Typography>--</Typography>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col py-4 px-5 items-start gap-3 self-stretch bg-[#323038]">
                <div className="flex items-center gap-3">
                  <Typography className="text-base font-medium">
                    Accrued fee
                  </Typography>
                  <div className="flex items-center py-[2px] px-[12px] bg-[#314243] shadow-[0_2px_12px_0px_rgba(11,14,25,0.12)]">
                    <Typography className="text-sm font-medium text-[#27E39F] leading-[20px]">
                      {data1.accruedFee}%
                    </Typography>
                  </div>
                </div>
                <Typography className="text-[32px] font-semibold">
                  {data1.status === "Close" ? "--" : "$0.000675"}
                </Typography>
                <div className="flex items-center self-stretch justify-between text-sm font-medium">
                  <div className="flex items-center gap-3">
                    <img
                      src={getTokenIcon(data?.poolInfo?.pair?.token0.address)}
                      alt=""
                      className="w-5 h-5"
                    />
                    <Typography>{data?.poolInfo?.pair?.token0.name}</Typography>
                  </div>
                  <Typography>
                    {data1.status === "Close" ? "0" : "< 0.001"}
                  </Typography>
                </div>
                <div className="flex items-center self-stretch justify-between text-sm font-medium">
                  <div className="flex items-center gap-3">
                    <img
                      src={getTokenIcon(data?.poolInfo?.pair?.token1.address)}
                      alt=""
                      className="w-5 h-5"
                    />
                    <Typography>{data?.poolInfo?.pair?.token1.name}</Typography>
                  </div>
                  <Typography>
                    {data1.status === "Close" ? "0" : "< 0.001"}
                  </Typography>
                </div>
              </div>
            </div>
            <div
              className={twMerge(
                "flex flex-col items-start gap-6 self-stretch",
                tab !== "add" && "hidden"
              )}
            >
              <div className="flex flex-col py-4 px-5 items-start gap-3 self-stretch bg-[#323038]">
                <div className="flex items-center self-stretch justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={getTokenIcon(data?.poolInfo?.pair?.token0.address)}
                      alt=""
                      className="w-5 h-5"
                    />
                    <Typography>
                      {data?.poolInfo?.pair?.token0.symbol}
                    </Typography>
                  </div>
                  <div className="flex items-center gap-6">
                    <Typography>
                      {Number(data?.poolInfo?.pair?.reserve0.raw.toString()) /
                        10 ** 18}
                    </Typography>
                  </div>
                </div>
                <div className="flex items-center self-stretch justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={getTokenIcon(data?.poolInfo?.pair?.token1.address)}
                      alt=""
                      className="w-5 h-5"
                    />
                    <Typography>
                      {" "}
                      {data?.poolInfo?.pair?.token1.symbol}
                    </Typography>
                  </div>
                  <div className="flex items-center gap-6">
                    <Typography>
                      {Number(data?.poolInfo?.pair?.reserve1.raw.toString()) /
                        10 ** 18}
                    </Typography>
                  </div>
                </div>
                <div className="flex items-center self-stretch justify-between">
                  <Typography>Parameter</Typography>
                  <Typography>{data1.parameter}</Typography>
                </div>
                <div className="flex items-center self-stretch justify-between">
                  <Typography>LP price</Typography>
                  <Typography>
                    {" "}
                    {data?.poolInfo?.pair?.token0Price.toFixed(2)}
                  </Typography>
                </div>
                <div className="flex items-center self-stretch justify-between">
                  <Typography>Fee</Typography>
                  <Typography>{data1.accruedFee}</Typography>
                </div>
              </div>
              {/* <div className="flex flex-col items-start self-stretch gap-4">
                <div className="flex flex-col items-start self-stretch gap-2">
                  <div className="flex flex-col items-start gap-5 self-stretch bg-[#131216] p-4">
                    <div className="flex items-center self-stretch justify-between">
                      <span className="text-lg font-normal text-white font-['Russo_One'] leading-[22px]">
                        You Pay
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Typography className="text-base font-normal leading-[24px]">
                            Balance:
                          </Typography>
                          <Typography className="text-base font-normal leading-[24px]">
                            {data?.balances?.[0]?.toSignificant(5)}
                          </Typography>
                        </div>
                        <div
                          className="flex h-6 justify-center items-center gap-[10px] bg-[#773030] px-4 cursor-pointer"
                          onClick={() =>
                            handleChangeAmounts(
                              data?.balances?.[0]
                                ?.toSignificant(3)
                                .toString() || "0",
                              Field.INPUT
                            )
                          }
                        >
                          <Typography className="text-xs font-bold leading-[15px]">
                            Max
                          </Typography>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-[2px] self-stretch">
                      <div className="flex items-center self-stretch justify-between">
                        <div className="flex items-center self-stretch justify-between">
                          <Input
                            placeholder="0.0"
                            className="border-none px-0 text-xl font-bold max-w-[100px] text-[#C6C6C6]"
                            value={tokenAmounts[Field.INPUT]}
                            onChange={(e) =>
                              handleChangeAmounts(e.target.value, Field.INPUT)
                            }
                          />
                        </div>
                        <div
                          className="flex justify-between items-center bg-[#1D1C21] py-[7px] px-3 cursor-pointer shadow-[0_2px_12px_0px_rgba(11,14,25,0.12)] w-[153px]"
                          onClick={() => {
                            setTypeModal(1);
                            setIsShowTokenModal(true);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={getTokenIcon(tokens[Field.INPUT]?.address)}
                              alt=""
                              className="w-5 h-5"
                            />
                            <Typography className="text-sm font-medium">
                              {tokens[Field.INPUT]?.symbol}
                            </Typography>
                          </div>
                          <ArrowDown />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-5 self-stretch bg-[#131216] p-4">
                    <div className="flex items-center self-stretch justify-between">
                      <span className="text-lg font-normal text-white font-['Russo_One']">
                        Your Receive
                      </span>
                      <div className="flex items-center gap-1">
                        <Typography className="text-base font-normal">
                          Balance:
                        </Typography>
                        <Typography className="text-base font-normal">
                          {data?.balances?.[1]?.toSignificant(5)}
                        </Typography>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-[2px] self-stretch">
                      <div className="flex items-center self-stretch justify-between">
                        <div className="flex items-center self-stretch justify-between">
                          <Input
                            placeholder="0.0"
                            className="border-none px-0 text-xl max-w-[100px] font-medium text-[#27E3AB]"
                            value={tokenAmounts[Field.OUTPUT]}
                            onChange={(e) =>
                              handleChangeAmounts(e.target.value, Field.OUTPUT)
                            }
                          />
                        </div>
                        <div
                          className="flex justify-between items-center bg-[#1D1C21] py-[7px] px-3 cursor-pointer shadow-[0_2px_12px_0px_rgba(11,14,25,0.12)] w-[153px]"
                          onClick={() => {
                            setTypeModal(2);
                            setIsShowTokenModal(true);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={getTokenIcon(tokens[Field.OUTPUT]?.address)}
                              alt=""
                              className="w-5 h-5"
                            />
                            <Typography className="text-sm font-medium">
                              {tokens[Field.OUTPUT]?.symbol}
                            </Typography>
                          </div>
                          <ArrowDown />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start self-stretch gap-8">
                  <div className="flex flex-col items-start self-stretch gap-4">
                    <div className="flex items-center self-stretch gap-5">
                      <div className="flex items-center gap-1">
                        <Typography className="text-base font-bold leading-[20px]">
                          Set Liquidity Concentration Parameter
                        </Typography>
                        <HelpIcon />
                      </div>
                    </div>
                    <div className="flex items-center self-stretch gap-2">
                      <Typography className="text-base font-medium leading-[24px] whitespace-nowrap">
                        0.8
                      </Typography>
                      <Slider
                        className="w-full"
                        defaultValue={k}
                        tooltip={{ open: true }}
                        max={2}
                        min={0.8}
                        step={0.1}
                        tooltipPlacement="bottom"
                        onChange={onChangeK}
                        disabled={disabled}
                      />
                      <Typography className="text-base font-medium leading-[24px]">
                        2
                      </Typography>
                    </div>
                  </div>
                  <div className="flex items-center self-stretch justify-between">
                    <Typography className="text-base font-bold leading-[20px]">
                      Capital Efficiency
                    </Typography>
                    <div className="flex h-8 items-center justify-center gap-1 px-4 bg-[#323038]">
                      <Typography className="text-xs font-bold">
                        1000x
                      </Typography>
                    </div>
                  </div>
                </div>
              </div> */}
              {Number(tokenAmounts[Field.INPUT]) >
              Number(data?.balances?.[0]?.toFixed(3)) ? (
                <div className="flex justify-center items-center gap-2 self-stretch py-[18px] px-6 bg-[#737373] cursor-pointer">
                  <Typography className="text-base font-bold">
                    Insufficient Balance
                  </Typography>
                </div>
              ) : (
                <div
                  className={twMerge(
                    "flex justify-center items-center gap-2 self-stretch py-[18px] px-6 bg-[#773030] cursor-pointer",
                    approveTx && "hidden"
                  )}
                  onClick={() => setIsShowReviewModal(true)}
                  // onClick={onApproveTokenCallback}
                >
                  <Typography className="text-base font-bold">
                    {isApprove
                      ? "Approving..."
                      : `Approve ${tokens[Field.INPUT]?.name}`}
                  </Typography>
                </div>
              )}
              <div
                className={twMerge(
                  "hidden justify-center items-center gap-2 self-stretch py-[18px] px-6 bg-[#773030] cursor-pointer",
                  approveTx && "flex"
                )}
                onClick={() => setIsShowReviewModal(true)}
                // onClick={onAddLiquidityCallback}
              >
                <Typography className="text-base font-bold">Add</Typography>
              </div>
            </div>
          </div>
          <div
            className={twMerge(
              "flex flex-col items-start gap-6 self-stretch",
              tab !== "remove" && "hidden"
            )}
          >
            <div className="flex flex-col items-start self-stretch gap-4">
              <div className="flex items-center self-stretch justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-start">
                    <img
                      src={getTokenIcon(data?.poolInfo?.pair?.token0.address)}
                      alt=""
                      className="w-5 h-5"
                    />
                    <img
                      src={getTokenIcon(data?.poolInfo?.pair?.token1.address)}
                      alt=""
                      className="ml-[-8px] w-5 h-5"
                    />
                  </div>
                  <Typography className="text-base font-medium">
                    {data?.poolInfo?.pair?.token0.name}/
                    {data?.poolInfo?.pair?.token1.name}
                  </Typography>
                </div>
                <div
                  className={twMerge(
                    "flex py-[2px] px-3 items-center gap-1 w-[74px]",
                    data1.status === "Active" && "bg-[rgba(39,227,159,0.10)]",
                    data1.status === "Close" && "bg-[rgba(255,59,106,0.10)]"
                  )}
                >
                  {data1.status === "Active" ? (
                    <ActiveIcon color="#27E39F" />
                  ) : (
                    <ActiveIcon color="#FF3B6A" />
                  )}
                  <Typography
                    className={twMerge(
                      "text-xs font-medium leading-[18px]",
                      data1.status === "Active" && "#27E39F",
                      data1.status === "Close" && "#FF3B6A"
                    )}
                  >
                    {data1.status}
                  </Typography>
                </div>
              </div>
              <div className="flex flex-col pt-4 pb-8 px-5 items-start gap-4 self-stretch bg-[#323038]">
                <div className="flex items-center self-stretch justify-between w-full">
                  <Typography className="text-base font-medium">
                    Amount
                  </Typography>
                  <div
                    className="flex h-6 px-4 justify-center items-center gap-1 bg-[#1E1E1E] cursor-pointer"
                    onClick={() => setTab("add")}
                  >
                    <Typography className="text-xs font-bold leading-[15px]">
                      Increase liquidity
                    </Typography>
                  </div>
                </div>
                <div className="flex flex-col items-start self-stretch gap-8">
                  <div className="flex items-center gap-5">
                    <Typography className="text-[32px] leading-[39px]">
                      {`${percent}%`}
                    </Typography>
                    {percentArray().map((item, idx) => (
                      <div
                        key={idx}
                        className="flex h-8 px-4 justify-center items-center gap-1 bg-[#27E3AB] cursor-pointer"
                        onClick={() => setPercent(item.value)}
                      >
                        <Typography className="text-xs font-bold text-[#1E1E1E]">
                          {item.label}
                        </Typography>
                      </div>
                    ))}
                  </div>
                  <Slider
                    className="w-full !m-0"
                    defaultValue={percent}
                    value={percent}
                    // tooltip={{ open: true }}
                    max={100}
                    min={0}
                    step={1}
                    tooltipPlacement="bottom"
                    onChange={onChangePercent}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
            <div className="flex py-3 px-5 flex-col items-start gap-3 self-stretch bg-[#323038] text-sm font-medium">
              <div className="flex items-center self-stretch justify-between">
                <Typography>
                  Pooled {data?.poolInfo?.pair?.token0.name}
                </Typography>
                <div className="flex items-center gap-3">
                  <Typography>{reserve0Persent?.toString() || "--"}</Typography>
                  <img
                    src={getTokenIcon(data?.poolInfo?.pair?.token0.address)}
                    alt=""
                    className="w-5 h-5"
                  />
                </div>
              </div>
              <div className="flex items-center self-stretch justify-between">
                <Typography>
                  Pooled {data?.poolInfo?.pair?.token1.name}
                </Typography>
                <div className="flex items-center gap-3">
                  <Typography>{reserve1Persent?.toString() || "--"}</Typography>
                  <img
                    src={getTokenIcon(data?.poolInfo?.pair?.token1.address)}
                    alt=""
                    className="w-5 h-5"
                  />
                </div>
              </div>
              <Divider className="!my-0" />
              <div className="flex items-center self-stretch justify-between">
                <Typography>
                  {data?.poolInfo?.pair?.token0.name} Fees Earned:
                </Typography>
                <div className="flex items-center gap-3">
                  <Typography>-</Typography>
                  <img
                    src={getTokenIcon(data?.poolInfo?.pair?.token0.address)}
                    alt=""
                    className="w-5 h-5"
                  />
                </div>
              </div>
              <div className="flex items-center self-stretch justify-between">
                <Typography>
                  {data?.poolInfo?.pair?.token1.name} Fees Earned:
                </Typography>
                <div className="flex items-center gap-3">
                  <Typography>-</Typography>
                  <img
                    src={getTokenIcon(data?.poolInfo?.pair?.token1.address)}
                    alt=""
                    className="w-5 h-5"
                  />
                </div>
              </div>
            </div>
            {!checkApprove ? (
              <div
                className={twMerge(
                  "flex justify-center items-center gap-2 self-stretch py-[18px] px-6 bg-[#773030] cursor-pointer",
                  approveTx && "hidden"
                )}
                onClick={onApproveTokenCallback}
              >
                <Typography className="text-base font-bold">
                  {isApprove ? "Approving..." : `Approve`}
                </Typography>
              </div>
            ) : (
              <div
                className="flex py-[18px] px-6 justify-center items-center gap-2 self-stretch bg-[#773030] cursor-pointer"
                onClick={removeLiquidity}
              >
                <Typography className="text-base font-bold leading-[20px]">
                  Remove
                </Typography>
              </div>
            )}
          </div>
        </div>
      </div>
      {isShowSetting && (
        <SettingParameter
          isShowing={isShowSetting}
          hide={setIsShowSetting}
          k={k}
          onChangeK={onChangeK}
          disabled={disabled}
        />
      )}
      {isShowReviewModal && (
        <ConfirmAddLP
          isShowing={isShowReviewModal}
          hide={setIsShowReviewModal}
          token0={data1.token0}
          token1={data1.token1}
          token0InputAmount={token0InputAmount}
          token1OutputAmount={token1OutputAmount}
        />
      )}
      {isShowConfirm && processRemove && (
        <ConfirmRemoveModal
          isShowing={isShowConfirm}
          processRemove={processRemove}
          hide={setIsShowConfirm}
          token0={data?.poolInfo?.pair?.token0}
          token1={data?.poolInfo?.pair?.token1}
          token0InputAmount={reserve0Persent?.decimalPlaces(6)?.toString()}
          token1OutputAmount={reserve1Persent?.decimalPlaces(6)?.toString()}
        />
      )}
      {isShowTokenModal && (
        <SelectTokenModal
          isShowing={isShowTokenModal}
          hide={setIsShowTokenModal}
          token0={tokens[Field.INPUT]}
          token1={tokens[Field.OUTPUT]}
          setToken={setTokens}
          typeModal={typeModal}
        />
      )}
      {/* {isShowReviewModal && (
        <ConfirmAddLP
          isShowing={isShowReviewModal}
          hide={setIsShowReviewModal}
          token0={tokens[Field.INPUT]}
          token1={tokens[Field.OUTPUT]}
          token0InputAmount={tokenAmounts[Field.INPUT]}
          token1OutputAmount={tokenAmounts[Field.OUTPUT]}
          onAddLiquidityCallback={onAddLiquidityCallback}
        />
      )} */}
    </div>
  );
};

type Tab = "view" | "add" | "remove";

type Percent = 25 | 50 | 75 | 100;

interface IPercent {
  label: string;
  value: Percent;
}

const percentArray = (): IPercent[] => [
  {
    label: "25%",
    value: 25,
  },
  {
    label: "50%",
    value: 50,
  },
  {
    label: "75%",
    value: 75,
  },
  {
    label: "Max",
    value: 100,
  },
];

export default YourPool;
