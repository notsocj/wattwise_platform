export type LeaderboardItem = {
  rank: number;
  name: string;
  usageKWh: number;
  cost: number;
  tag: "HIGH COST" | "MODERATE" | "EFFICIENT";
  tagColor: "text-danger" | "text-naku" | "text-bida";
};
