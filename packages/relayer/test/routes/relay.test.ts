import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { INVALID_ERROR_BODY } from '../inputs/errors.js';
import { relayProof } from '../inputs/proof.js';
import { App } from 'supertest/types.js';
import { originalConfig } from '../inputs/originalConfig.js';

const chainConfig = originalConfig.chains[0]!;

describe('Relay Route - Chain ethereum (1)', () => {

  const VALID_CHAIN_ID = chainConfig.chain_id;

  const validRelayPayload = (withdrawalData: bigint[]) => ({
    withdrawal: {
      processooor: "0x248be73ad9087517e4624c29ce4ac84a76c8b479",
      data: withdrawalData,
    },
    publicSignals: relayProof.publicSignals,
    proof: relayProof.proof,
    scope: "914252416149542018943135422021350408877910118150300123819183553188073868709",
    chainId: VALID_CHAIN_ID,
  });
  let app: App;

  beforeAll(async () => {
    app = await createApp();
  });

  describe.concurrent('crappy-path', () => {

    it('should handle relay route with empty data', async () => {
      const response = await request(app)
        .post('/relayer/request')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should validate request body structure', async () => {
      const response = await request(app)
        .post('/relayer/request')
        .send({ invalidField: 'test' });

      expect(response.status).toBe(400);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send('invalid json');
      expect(response.status).toBe(400);
    });
 
    const DUMMY_WITHDRAWAL_DATA = [1n, 2n, 3n];

    it('should expect a withdrawal object', async () => {
      const validPayload = validRelayPayload(DUMMY_WITHDRAWAL_DATA)
      const { withdrawal: _withdrawal, ...relayPayload} = validPayload;

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'withdrawal: Required';

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });

    it('should expect publicSignals field', async () => {
      const validPayload = validRelayPayload(DUMMY_WITHDRAWAL_DATA)
      const { publicSignals: _publicSignals, ...relayPayload} = validPayload;

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'publicSignals: Required';

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });

    it('should expect proof field', async () => {
      const validPayload = validRelayPayload(DUMMY_WITHDRAWAL_DATA)
      const { proof: _proof, ...relayPayload} = validPayload;

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'proof: Required';

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });

    it('should expect scope field', async () => {
      const validPayload = validRelayPayload(DUMMY_WITHDRAWAL_DATA)
      const { scope: _scope, ...relayPayload} = validPayload;

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'scope: Invalid input'; // TODO: Interesting error, maybe should be Required

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });

    it('should expect withdrawal processor field', async () => {
      const validPayload = validRelayPayload(DUMMY_WITHDRAWAL_DATA)
      const { withdrawal: {data, processooor: _}, ...payload} = validPayload;
      const relayPayload = { ...payload, withdrawal: {data}}

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'withdrawal.processooor: Required';

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });

    it('should expect withdrawal data field', async () => {
      const validPayload = validRelayPayload(DUMMY_WITHDRAWAL_DATA)
      const { withdrawal: {data: _, processooor}, ...payload} = validPayload;
      const relayPayload = { ...payload, withdrawal: {processooor}}

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'withdrawal.data: Required';

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });
  });
});
