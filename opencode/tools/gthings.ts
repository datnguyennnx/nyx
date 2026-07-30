import { tool } from "@opencode-ai/plugin"
import { execFile } from "child_process"

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
  if (args.extractResults) cmd.push("--extract-results")
  if (args.maxChars !== undefined) cmd.push("--max-chars", String(args.maxChars))
  if (args.offset !== undefined) cmd.push("--offset", String(args.offset))
  if (args.maxNodes !== undefined) cmd.push("--max-nodes", String(args.maxNodes))
  if (args.dedup) cmd.push("--dedup", args.dedup)
  if (args.rank) cmd.push("--rank", args.rank)
  if (args.followTop !== undefined) cmd.push("--follow-top", String(args.followTop))
  if (args.warnTabs !== undefined) cmd.push("--warn-tabs", String(args.warnTabs))

  // Always use --output json (except for update which has its own output)
  cmd.push("--output", "json")

  return cmd
}

export default tool({
  description:
    "Browser automation and web research via gthings CLI — search, extract, ax, pdf-url, pdf-file, status, update. Each call takes ~4-6s due to CDP browser startup (Rust binary + Chrome DevTools Protocol connection).",
  args: {
    command: tool.schema
      .enum(["search", "extract", "ax", "pdf-url", "pdf-file", "status", "update"])
      .describe("Subcommand to run"),
    query: tool.schema
      .string()
      .describe("Search query, URL, or file path (depends on command)")
      .optional(),
    queries: tool.schema
      .array(tool.schema.string())
      .describe("Multiple search queries (search command only)")
      .optional(),
    count: tool.schema
      .number()
      .describe("Number of search results (default: 5)")
      .optional(),
    strategy: tool.schema
      .enum(["simple", "parallel", "harvest"])
      .describe("Search strategy (default: simple)")
      .optional(),
    extractResults: tool.schema
      .boolean()
      .describe("Extract full content from search result pages")
      .optional(),
    maxChars: tool.schema
      .number()
      .describe("Max characters to extract (default: 15000)")
      .optional(),
    offset: tool.schema
      .number()
      .describe("Content offset (default: 0)")
      .optional(),
    maxNodes: tool.schema
      .number()
      .describe("Max DOM nodes for ax traversal (default: 1000)")
      .optional(),
    dedup: tool.schema
      .string()
      .describe("Dedup strategy for harvest search (default: url)")
      .optional(),
    rank: tool.schema
      .string()
      .describe("Rank strategy for harvest search (default: composite)")
      .optional(),
    followTop: tool.schema
      .number()
      .describe("Number of top results to follow in harvest search (default: 8)")
      .optional(),
    warnTabs: tool.schema
      .number()
      .describe("Warn tabs threshold for harvest search (default: 20)")
      .optional(),
  },
  async execute(args, context) {
    const cmdArgs = buildArgs(args)

    const result = await new Promise<string>((resolve, reject) => {
      const child = execFile("gthings", cmdArgs, {
        encoding: "utf-8",
        timeout: 30000,
        env: {
          ...process.env,
          RUST_LOG: process.env.RUST_LOG || "error",
          ...(process.env.GTHINGS_CDP_PORT ? {
            GTHINGS_CDP_PORT: process.env.GTHINGS_CDP_PORT
          } : {}),
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

      if (context?.abort) {
        context.abort.addEventListener("abort", () => { child.kill() }, { once: true })
      }
    })

    return result
  },
})
