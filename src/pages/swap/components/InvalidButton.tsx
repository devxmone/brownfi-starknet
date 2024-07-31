import { Tooltip } from "antd";

export const InvalidButton = (props: any) => {
  return (
    <div className="flex items-center justify-center gap-2 self-stretch px-6 py-[18px] bg-[#737373]">
      <span className="text-base font-bold text-[rgba(255,255,255,0.50)]">
        Invalid Amount
      </span>
      <InfoIcon />
    </div>
  );
};

const InfoIcon = () => {
  return (
    <Tooltip
      arrow={false}
      title="Amount must be greater than 0 and smaller than 25% of token reserve in the pool)"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
      >
        <g clipPath="url(#clip0_2238_378)">
          <path
            d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z"
            fill="white"
          />
        </g>
        <defs>
          <clipPath id="clip0_2238_378">
            <rect width="24" height="24" fill="white" />
          </clipPath>
        </defs>
      </svg>
    </Tooltip>
  );
};
