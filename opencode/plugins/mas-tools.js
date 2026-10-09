// opencode/plugins/mas-tools.js — V2 plugin, three tool wrappers over MAS scripts.
//   mas_plan_check      -> ~/.config/opencode/scripts/check-slices.mjs
//   mas_config_validate -> ~/.config/opencode/scripts/validate-mas.mjs
//   mas_envelope_lint   -> ~/.config/opencode/scripts/envelope-lint.mjs
import { Plugin } from "@opencode/plugin";
import { execFile } from "node:child_process";
import os from "node:os";

const SCRIPTS = `${os.homedir()}/.config/opencode/scripts`;
const TIMEOUT_MS = 30000;

const run = (script, argv = []) =>
  new Promise((resolve) => {
    execFile(
      process.execPath,
      [`${SCRIPTS}/${script}`, ...argv],
      { shell: false, timeout: TIMEOUT_MS },
      (error, stdout, stderr) => {
        const code = error && typeof error.code === "number" ? error.code : 0;
        const detail = error && typeof error.code !== "number" ? `\n${error.message}` : "";
        resolve({ content: `exit ${code}\n${stdout ?? ""}${stderr ?? ""}${detail}` });
      },
    );
  });

export default Plugin.define({
  id: "mas-tools",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "mas_plan_check",
        description: "Validate a MAS lane plan via check-slices.mjs.",
        input: {
          type: "object",
          properties: {
            lanes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  level: { type: "number" },
                  targets: { type: "array", items: { type: "string" } },
                },
                required: ["id", "level", "targets"],
              },
            },
          },
          required: ["lanes"],
          additionalProperties: false,
        },
        async execute({ lanes }) {
          return run("check-slices.mjs", [JSON.stringify(lanes)]);
        },
      });
      editor.add({
        name: "mas_config_validate",
        description: "Validate the MAS config via validate-mas.mjs.",
        input: { type: "object", properties: {}, additionalProperties: false },
        async execute() {
          return run("validate-mas.mjs");
        },
      });
      editor.add({
        name: "mas_envelope_lint",
        description: "Lint an MAS envelope via envelope-lint.mjs.",
        input: {
          type: "object",
          properties: {
            input: { type: "string" },
            inputFile: { type: "string" },
            selftest: { type: "boolean" },
          },
          additionalProperties: false,
        },
        async execute({ input, inputFile, selftest } = {}) {
          const argv = selftest
            ? ["--selftest"]
            : inputFile
              ? ["--input-file", inputFile]
              : input
                ? ["--input", input]
                : [];
          return run("envelope-lint.mjs", argv);
        },
      });
    });
  },
});
