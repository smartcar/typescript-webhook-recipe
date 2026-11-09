import { jest } from '@jest/globals';
import { createHmac } from 'node:crypto';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const AMT = 'test-application-management-token';
const sqsSend = jest.fn(async () => ({}));

jest.unstable_mockModule('@aws-lambda-powertools/parameters/secrets', () => ({
    getSecret: jest.fn(async () => AMT),
}));
jest.unstable_mockModule('@aws-sdk/client-sqs', () => ({
    SQSClient: jest.fn(() => ({ send: sqsSend })),
    SendMessageCommand: jest.fn((params) => params),
}));

const { receiver, isValidSignature } = await import('../../../src/lambdas/api/index.js');

const hmac = (value: string) => createHmac('sha256', AMT).update(value).digest('hex');

const makeEvent = (body: string, headers: Record<string, string> = {}) =>
    ({ body, headers } as unknown as APIGatewayProxyEvent);

const verifyBody = (challenge: unknown) =>
    JSON.stringify({ eventId: 'e1', eventType: 'VERIFY', data: { challenge }, meta: { version: '4.0' } });

// A VERIFY request as Smartcar sends it: body plus a valid SC-Signature over
// that exact body. Only the holder of the AMT (Smartcar) can produce this.
const signedVerify = (challenge: unknown) => {
    const body = verifyBody(challenge);
    return makeEvent(body, { 'SC-Signature': hmac(body) });
};

const VALID_CHALLENGE = 'challenge_0123456789abcdef0123456789abcdef';

beforeEach(() => {
    sqsSend.mockClear();
});

describe('VERIFY', () => {
    test('answers a correctly signed challenge', async () => {
        const res = await receiver(signedVerify(VALID_CHALLENGE));
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ challenge: hmac(VALID_CHALLENGE) });
    });

    test('rejects a VERIFY with no SC-Signature', async () => {
        const res = await receiver(makeEvent(verifyBody(VALID_CHALLENGE)));
        expect(res.statusCode).toBe(401);
    });

    test('rejects a VERIFY with a wrong SC-Signature', async () => {
        const res = await receiver(makeEvent(verifyBody(VALID_CHALLENGE), { 'SC-Signature': hmac('nope') }));
        expect(res.statusCode).toBe(401);
    });

    test.each([
        ['an empty string', ''],
        ['a non-string', 12345],
    ])('rejects a signed VERIFY with %s as the challenge', async (_label, challenge) => {
        const res = await receiver(signedVerify(challenge));
        expect(res.statusCode).toBe(400);
    });
});

describe('signature-swap attack (ENG-3235)', () => {
    test('a VERIFY response cannot be used to sign a forged event', async () => {
        const forged = JSON.stringify({
            eventId: 'x',
            eventType: 'VEHICLE_STATE',
            data: { vehicle: { id: 'abc-123' } },
            meta: { version: '4.0' },
        });

        // The attacker doesn't have the AMT, so they can't sign the VERIFY
        // request. It's rejected before any hashing, and the receiver never
        // returns HMAC(AMT, forged) — which would be a valid event signature.
        const verifyRes = await receiver(makeEvent(verifyBody(forged)));
        expect(verifyRes.statusCode).toBe(401);
        expect(verifyRes.body).not.toContain(hmac(forged));

        // Without that signature, the forged event is rejected.
        const eventRes = await receiver(makeEvent(forged, { 'SC-Signature': hmac('anything') }));
        expect(eventRes.statusCode).toBe(400);
        expect(sqsSend).not.toHaveBeenCalled();
    });
});

describe('event signature', () => {
    const body = JSON.stringify({ eventId: 'e2', eventType: 'VEHICLE_STATE', data: {}, meta: { version: '4.0' } });

    test('accepts a valid signature over the raw body', async () => {
        const res = await receiver(makeEvent(body, { 'SC-Signature': hmac(body) }));
        expect(res.statusCode).toBe(200);
        expect(sqsSend).toHaveBeenCalledTimes(1);
    });

    test('reads the header case-insensitively', async () => {
        const res = await receiver(makeEvent(body, { 'sc-signature': hmac(body) }));
        expect(res.statusCode).toBe(200);
    });

    test('rejects a missing signature', async () => {
        const res = await receiver(makeEvent(body));
        expect(res.statusCode).toBe(400);
        expect(sqsSend).not.toHaveBeenCalled();
    });

    test('rejects a wrong signature', async () => {
        const res = await receiver(makeEvent(body, { 'SC-Signature': hmac('something else') }));
        expect(res.statusCode).toBe(400);
        expect(sqsSend).not.toHaveBeenCalled();
    });

    test('rejects a signature computed over a re-serialized body', async () => {
        const pretty = JSON.stringify(JSON.parse(body), null, 2);
        const res = await receiver(makeEvent(pretty, { 'SC-Signature': hmac(body) }));
        expect(res.statusCode).toBe(400);
        expect(sqsSend).not.toHaveBeenCalled();
    });
});

describe('helpers', () => {
    test('isValidSignature rejects non-hex and wrong-length signatures', () => {
        expect(isValidSignature(AMT, 'body', 'not-hex')).toBe(false);
        expect(isValidSignature(AMT, 'body', hmac('body').slice(0, 10))).toBe(false);
        expect(isValidSignature(AMT, 'body', undefined)).toBe(false);
        expect(isValidSignature(AMT, 'body', hmac('body'))).toBe(true);
    });
});
