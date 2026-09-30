import { execFile } from "node:child_process"
import { z } from "zod"
import { Plugin } from "@opencode/plugin"

function buildArgs(args: {
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
}): string[] {
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

type GthingsInput = Parameters<typeof buildArgs>[0]

async function runGthings(input: GthingsInput): Promise<string> {
  const cmdArgs = buildArgs(input)

  return new Promise<string>((resolve, reject) => {
    execFile("gthings", cmdArgs, {
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
        const codeStr = (error as NodeJS.ErrnoException).code
          ? ` (exit ${(error as NodeJS.ErrnoException).code})`
          : ""
        const signalStr = (error as NodeJS.ErrnoException & { signal?: string }).signal
          ? ` [signal ${(error as NodeJS.ErrnoException & { signal?: string }).signal}]`
          : ""
        reject(new Error((stderr?.trim() || error.message) + codeStr + signalStr))
        return
      }
      resolve(stdout?.trim() ?? "")
    })
  })
}

export default Plugin.define({
  id: "gthings",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "gthings",
        description:
          "Browser automation and web research via gthings CLI: search, extract, ax, pdf-url, pdf-file, status, update. Each call takes ~4-6s due to CDP browser startup (Rust binary + Chrome DevTools Protocol connection).",
        input: z.object({
          command: z
            .enum(["search", "extract", "ax", "pdf-url", "pdf-file", "status", "update", "describe"])
            .describe("Subcommand to run"),
          query: z.string().optional().describe("Search query, URL, or file path (depends on command)"),
          queries: z
            .array(z.string())
            .optional()
            .describe("Multiple search queries (search command only)"),
          count: z.number().optional().describe("Number of search results (default: 5)"),
          strategy: z.enum(["simple", "parallel", "harvest"]).optional().describe("Search strategy (default: simple)"),
          engine: z.enum(["auto", "brave", "bing", "google"]).optional().describe("Search engine (default: auto)"),
          extractResults: z.boolean().optional().describe("Extract full content from search result pages"),
          maxChars: z.number().optional().describe("Max characters to extract (default: 40000)"),
          offset: z.number().optional().describe("Content offset (default: 0)"),
          maxNodes: z.number().optional().describe("Max DOM nodes for ax traversal (default: 500)"),
          dedup: z.string().optional().describe("Dedup strategy for harvest search (default: url)"),
          rank: z.string().optional().describe("Rank strategy for harvest search (default: composite)"),
          followTop: z
            .number()
            .optional()
            .describe("Number of top results to follow in harvest search (default: 8)"),
          warnTabs: z
            .number()
            .optional()
            .describe("Warn tabs threshold for harvest search (default: 20)"),
        }),
        execute: async (args) => {
          const output = await runGthings(args as GthingsInput)
          return { content: output }
        },
      })
    })
  },
})
