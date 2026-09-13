import assert from "node:assert/strict"
import test from "node:test"

test("passes the configured multiline literal through the home logo renderer", async (context) => {
  const mockOptions = {
    exports: {
      Fragment: Symbol("Fragment"),
      jsx: (type: unknown, properties: unknown) => ({ type, properties }),
      jsxs: (type: unknown, properties: unknown) => ({ type, properties }),
    },
  } as unknown as Parameters<typeof context.mock.module>[1]
  context.mock.module("@opentui/solid/jsx-runtime", mockOptions)

  const { default: plugin } = await import("../src/index.js")
  let registered: {
    slots: { home_logo: () => unknown }
  } | undefined
  const api = {
    slots: {
      register(value: typeof registered) {
        registered = value
        return "test-registration"
      },
    },
  }

  await plugin.tui(api as never, { logo: "first\n\u001b[31msecond\u001b[0m" })

  assert.deepEqual(registered?.slots.home_logo(), {
    type: "text",
    properties: {
      children: "first\n\\u001b[31msecond\\u001b[0m",
    },
  })
})
