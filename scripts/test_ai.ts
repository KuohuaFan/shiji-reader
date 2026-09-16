import { appRouter } from "../server/routers";

const caller = appRouter.createCaller({
  req: { ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } },
  res: {},
  user: null,
} as never);

const result = await caller.shiji.ask({
  volume: 1,
  question: "黃帝為什麼稱為黃帝？索隱如何解釋？",
  history: [],
  sources: ["索隱"],
  period: "上古與五帝",
});

if (!result.answer || !result.citations.length) {
  throw new Error("AI answer or citations are empty");
}
if (!result.citations.some(item => item.layer === "索隱")) {
  throw new Error("AI answer does not cite the selected 索隱 layer");
}
if (result.citations.some(item => ["原文", "集解", "正義"].includes(item.layer))) {
  throw new Error("AI answer cited an unselected primary source");
}
console.log(JSON.stringify(result, null, 2));
console.log("AI_QA_OK");
