import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Browser automation and web research via gthings CLI — search Google, follow pages, batch search, extract content, harvest results, extract PDFs",
  args: {
    command: tool.schema
      .enum(["search", "follow", "batch", "extract", "harvest", "pdf", "status"])
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
  },
  async execute(args) {
    const parts: string[] = ["gthings"]
    parts.push(args.command)

    if (args.command === "pdf" && args.pdfSubcommand) {
      parts.push(args.pdfSubcommand)
    }

    if (args.command === "pdf" && args.pdfSubcommand === "file" && args.filePath) {
      parts.push(JSON.stringify(args.filePath))
    } else if (args.query) {
      parts.push(JSON.stringify(args.query))
    } else if ((args.command === "batch" || args.command === "harvest") && args.queries?.length) {
      for (const q of args.queries) {
        parts.push(JSON.stringify(q))
      }
    }

    if (args.count) parts.push(`--count=${args.count}`)
    if (args.maxChars) parts.push(`--max-chars=${args.maxChars}`)
    if (args.follow) parts.push("--follow")
    parts.push("--json")

    const { execSync } = await import("child_process")
    try {
      const stdout = execSync(parts.join(" "), {
        encoding: "utf-8",
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, RUST_LOG: "error" },
      })
      return stdout.trim()
    } catch (e: any) {
      return `Error: ${e.stderr?.trim() || e.message}`
    }
  },
})
