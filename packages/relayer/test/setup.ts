import { Instance, Server } from 'prool';

const server = Server.create({
  instance: Instance.anvil({
    chainId: 1,
    forkUrl: process.env.EVM_MAINNET_RPC_URL,
  }),
  port: 8545,
});

export default async function setup() {
  await server.start();
  return async () => {
    await server.stop();
  };
}
