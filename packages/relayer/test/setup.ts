import { Instance, Server } from 'prool';

const server = Server.create({
  instance: Instance.anvil({
    chainId: 1,
  }),
  port: 8545,
});

export default async function setup() {
  await server.start();
  return async () => {
    await server.stop();
  };
}
