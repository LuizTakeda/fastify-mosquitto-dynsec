import test from "node:test";
import assert from "node:assert";
import { createAclAPI, DefaultACLRule } from "../src/acl.js";
import { DynsecError } from "../src/errors.js";
import type { SendCommandsFunction } from "../src/index.js";

function createMockSender(provider: (commands: any) => any): SendCommandsFunction {
  return async <T = unknown>(commands: object): Promise<T> => {
    return provider(commands) as T;
  };
}

test("acl-mock", { concurrency: 1 }, async (t) => {
  await t.test("setDefaultAccess() should dispatch setDefaultACLAccess command and succeed", async () => {
    let capturedCommands: any = null;

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [{ command: "setDefaultACLAccess" }],
      };
    });

    const aclAPI = createAclAPI(mockSendCommands);
    const rules: DefaultACLRule[] = [
      { acltype: "publishClientSend", allow: false },
      { acltype: "publishClientReceive", allow: true },
      { acltype: "subscribe", allow: false },
      { acltype: "unsubscribe", allow: true },
    ];

    await aclAPI.setDefaultAccess({ acls: rules });

    assert.deepStrictEqual(capturedCommands, {
      commands: [
        {
          command: "setDefaultACLAccess",
          acls: rules,
        },
      ],
    });
  });

  await t.test("setDefaultAccess() should throw DynsecError when broker returns an error", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [{ command: "setDefaultACLAccess", error: "Invalid ACL configuration" }],
    }));

    const aclAPI = createAclAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await aclAPI.setDefaultAccess({
          acls: [{ acltype: "publishClientSend", allow: false }],
        });
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Invalid ACL configuration");
        assert.strictEqual(err.command, "setDefaultACLAccess");
        return true;
      }
    );
  });

  await t.test("getDefaultAccess() should dispatch getDefaultACLAccess command and return acls array", async () => {
    let capturedCommands: any = null;

    const expectedRules: DefaultACLRule[] = [
      { acltype: "publishClientSend", allow: false },
      { acltype: "publishClientReceive", allow: true },
      { acltype: "subscribe", allow: false },
      { acltype: "unsubscribe", allow: true },
    ];

    const mockSendCommands = createMockSender((commands) => {
      capturedCommands = commands;
      return {
        responses: [
          {
            command: "getDefaultACLAccess",
            data: {
              acls: expectedRules,
            },
          },
        ],
      };
    });

    const aclAPI = createAclAPI(mockSendCommands);
    const acls = await aclAPI.getDefaultAccess();

    assert.deepStrictEqual(capturedCommands, {
      commands: [{ command: "getDefaultACLAccess" }],
    });
    assert.deepStrictEqual(acls, expectedRules);
  });

  await t.test("getDefaultAccess() should throw DynsecError when broker returns an error", async () => {
    const mockSendCommands = createMockSender(() => ({
      responses: [{ command: "getDefaultACLAccess", error: "Internal server error" }],
    }));

    const aclAPI = createAclAPI(mockSendCommands);

    await assert.rejects(
      async () => {
        await aclAPI.getDefaultAccess();
      },
      (err: any) => {
        assert.ok(err instanceof DynsecError);
        assert.strictEqual(err.message, "Internal server error");
        assert.strictEqual(err.command, "getDefaultACLAccess");
        return true;
      }
    );
  });
});
