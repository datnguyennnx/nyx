import { tool } from "@opencode-ai/plugin"
import { execFile } from "child_process"

function buildArgs(args: {
  command: string
  query?: string
  queries?: string[]
  count?: number
  maxChars?: number
  offset?: number
  follow?: boolean
  pdfSubcommand?: string
  filePath?: string
  dedup?: string
  rank?: string
  followTop?: number
  warnTabs?: number
}): string[] {
  const cmd: string[] = [args.command]

  if (args.command === "pdf" && args.pdfSubcommand) {
    cmd.push(args.pdfSubcommand)
  }

  if (args.command === "pdf" && args.pdfSubcommand === "file" && args.filePath) {
    cmd.push(args.filePath)
  } else if (args.query) {
    cmd.push(args.query)
  } else if (
    (args.command === "batch" || args.command === "harvest") &&
    args.queries?.length
  ) {
    cmd.push(...args.queries)
  }

  if (args.count !== undefined) {
    cmd.push("--count", String(args.count))
  }
  if (args.maxChars !== undefined) {
    cmd.push("--max-chars", String(args.maxChars))
  }
  if (args.offset !== undefined) {
    cmd.push("--offset", String(args.offset))
  }
  if (args.follow) {
    cmd.push("--follow")
  }
  if (args.dedup !== undefined) {
    cmd.push("--dedup", args.dedup)
  }
  if (args.rank !== undefined) {
    cmd.push("--rank", args.rank)
  }
  if (args.followTop !== undefined) {
    cmd.push("--follow-top", String(args.followTop))
  }
  if (args.warnTabs !== undefined) {
    cmd.push("--warn-tabs", String(args.warnTabs))
  }
  if (args.command !== "update") {
    cmd.push("--json")
  }

  return cmd
}

export default tool({
  description:
    "Browser automation and web research via gthings CLI — search, follow, batch, extract, harvest, pdf, status, update",
  args: {
    command: tool.schema
      .enum(["search", "follow", "batch", "extract", "harvest", "pdf", "status", "update"])
      .describe("Subcommand to run"),
    query: tool.schema
      .string()
      .describe("Search query or URL (required for search, follow, extract, pdf url)")
      .optional(),
    queries: tool.schema
      .array(tool.schema.string())
      .describe("Multiple queries (for batch, harvest)")
      .optional(),
    count: tool.schema
      .number()
      .describe("Number of results (default: 5)")
      .optional(),
    maxChars: tool.schema
      .number()
      .describe("Max characters to extract (default: 15000)")
      .optional(),
    offset: tool.schema
      .number()
      .describe("Content offset (default: 0)")
      .optional(),
    follow: tool.schema
      .boolean()
      .describe("Also follow top result URLs (batch only)")
      .optional(),
    pdfSubcommand: tool.schema
      .enum(["url", "file"])
      .describe("PDF subcommand type")
      .optional(),
    filePath: tool.schema
      .string()
      .describe("Local file path (pdf file only)")
      .optional(),
    dedup: tool.schema
      .string()
      .describe("Dedup strategy for harvest (default: url)")
      .optional(),
    rank: tool.schema
      .string()
      .describe("Rank strategy for harvest (default: composite)")
      .optional(),
    followTop: tool.schema
      .number()
      .describe("Number of top results to follow in harvest (default: 8)")
      .optional(),
    warnTabs: tool.schema
      .number()
      .describe("Warn tabs threshold for harvest (default: 20)")
      .optional(),
  },
  async execute(args, context) {
    const cmdArgs = buildArgs(args)

    const result = await new Promise<string>((resolve, reject) => {
      const child = execFile("gthings", cmdArgs, {
        encoding: "utf-8",
        timeout: 120000,
        env: { ...process.env, RUST_LOG: process.env.RUST_LOG || "warn" },
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
