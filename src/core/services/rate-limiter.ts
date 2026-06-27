import Bottleneck from "bottleneck";

export const aiGatewayBottleneck = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200
});
