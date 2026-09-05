import { Plugin } from "@opencode-ai/plugin"
import { execFile } from "child_process"

interface GthingsArgs {
  command: string
  query?: string
  queries?: string[]
  count?: number
  maxChars?: number
  offset?: number
  strategy?: string
  extractResults?: boolean
  maxNodes?: number
  dedup?: string
  rank?: string
  followTop?: number
  warnTabs?: number
  engine?: string
}

function buildArgs(args: GthingsArgs): string[] {
  const cmd: string[] = [args.command]

  // Add positional args based on command
  if (args.command === "search") {
    if (args.queries?.length) {
      cmd.push(...args.queries)
    } else if (args.query) {
      cmd.push(args.query)
    }
  } else if (args.command === "pdf-file") {
    if (args.query) cmd.push(args.query) // file path
  } else if (args.query) {
    cmd.push(args.query) // url for extract/ax/pdf-url
  }

  // Flags
  if (args.count !== undefined) cmd.push("--count", String(args.count))
  if (args.strategy) cmd.push("--strategy", args.strategy)
  if (args.engine && args.engine !== "auto") cmd.push("--engine", args.engine)
  if (args.extractResults) cmd.push("--extract-results")
  if (args.maxChars !== undefined) cmd.push("--max-chars", String(args.maxChars))
  if (args.offset !== undefined) cmd.push("--offset", String(args.offset))
  if (args.maxNodes !== undefined) cmd.push("--max-nodes", String(args.maxNodes))
  if (args.dedup) cmd.push("--dedup", args.dedup)
  if (args.rank) cmd.push("--rank", args.rank)
  if (args.followTop !== undefined) cmd.push("--follow-top", String(args.followTop))
  if (args.warnTabs !== undefined) cmd.push("--warn-tabs", String(args.warnTabs))

  // Always use --output json (except for update/describe which accept no options)
  if (args.command !== "update" && args.command !== "describe") {
    cmd.push("--output", "json")
  }

  return cmd
}

export default Plugin.define({
  id: "gthings",
  async setup(ctx) {
    await ctx.tool.transform((draft) => {
      draft.add({
        name: "gthings",
        description:
          "Browser automation and web research via gthings CLI — search, extract, ax, pdf-url, pdf-file, status, update. Each call takes ~4-6s due to CDP browser startup (Rust binary + Chrome DevTools Protocol connection).",
        input: {
          type: "object",
          properties: {
            command: {
              type: "string",
              enum: ["search", "extract", "ax", "pdf-url", "pdf-file", "status", "update", "describe"],
              description: "Subcommand to run",
            },
            query: {
              type: "string",
              description: "Search query, URL, or file path (depends on command)",
            },
            queries: {
              type: "array",
              items: { type: "string" },
              description: "Multiple search queries (search command only)",
            },
            count: {
              type: "number",
              description: "Number of search results (default: 5)",
            },
            strategy: {
              type: "string",
              enum: ["simple", "parallel", "harvest"],
              description: "Search strategy (default: simple)",
            },
            engine: {
              type: "string",
              enum: ["auto", "brave", "bing", "google"],
              description: "Search engine (default: auto)",
            },
            extractResults: {
              type: "boolean",
              description: "Extract full content from search result pages",
            },
            maxChars: {
              type: "number",
              description: "Max characters to extract (default: 40000)",
            },
            offset: {
              type: "number",
              description: "Content offset (default: 0)",
            },
            maxNodes: {
              type: "number",
              description: "Max DOM nodes for ax traversal (default: 500)",
            },
            dedup: {
              type: "string",
              description: "Dedup strategy for harvest search (default: url)",
            },
            rank: {
              type: "string",
              description: "Rank strategy for harvest search (default: composite)",
            },
            followTop: {
              type: "number",
              description: "Number of top results to follow in harvest search (default: 8)",
            },
            warnTabs: {
              type: "number",
              description: "Warn tabs threshold for harvest search (default: 20)",
            },
          },
          required: ["command"],
          additionalProperties: false,
        },
        execute: async (input) => {
          const args = input as GthingsArgs
          const cmdArgs = buildArgs(args)

          const result = await new Promise<string>((resolve, reject) => {
            const child = execFile("gthings", cmdArgs, {
              encoding: "utf-8",
              timeout: 30000,
              env: {
                ...process.env,
                RUST_LOG: process.env.RUST_LOG || "error",
                ...(process.env.GTHINGS_CDP_PORT
                  ? { GTHINGS_CDP_PORT: process.env.GTHINGS_CDP_PORT }
                  : {}),
              },
            }, (error, stdout, stderr) => {
              if (error) {
                const codeStr = error.code ? ` (exit ${error.code})` : ""
                const signalStr = error.signal ? ` [signal ${error.signal}]` : ""
                reject(new Error((stderr?.trim() || error.message) + codeStr + signalStr))
                return
              }
              resolve(stdout?.trim() ?? "")
            })
          })

          return { content: result }
        },
      })
    })
  },
})