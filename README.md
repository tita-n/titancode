# Titan Code

![Titan Code Logo](https://via.placeholder.com/800x200.png?text=Titan+Code+-+Your+AI+Workforce+Agent)  
*(Replace this placeholder with your actual logo once generated – something epic with a titan + terminal vibe)*

**Titan Code** is an open-source terminal-based AI agent that goes beyond coding. Switch between **50+ job roles** (Software Engineer, Product Manager, UX Designer, Data Analyst, Marketer, and more) to build your virtual startup team.

Forked from the awesome [OpenCode](https://github.com/anomalyco/opencode) and enhanced with role-switching superpowers. Perfect for solo founders, bootstrapped teams, or anyone who needs an AI that can wear multiple hats.

### Why Titan Code?

- **Role Switching**: Use `/role software_engineer` for full coding power, `/role product_manager` for planning and research (with safe tools only), and so on.
- **Strict Boundaries**: Ask something outside the current role? It rejects and tells you to switch – keeps things professional and focused.
- **BYOK Everything**: Bring your own keys for any model (Claude, Gemini, Grok, OpenAI, local Ollama) + tools like web search.
- **Startup-Friendly**: Non-coding roles get useful tools (web search, planning outputs) without risky file edits.
- **100% Open Source**: No lock-in, runs locally, privacy-first.

Early stage project – actively building more roles, smarter tool permissions, and weak-model optimizations.

### Installation

```bash
# YOLO install
curl -fsSL https://opencode.ai/install | bash
```

After install, you can rename or alias the binary to `titancode`:

```bash
# Create an alias (add to your shell config)
alias titancode=opencode
```

Or build from source (see Development section below).

### Quick Start

Launch it:

```bash
opencode  # or titancode once aliased
```

Inside the TUI:

- `/role list` → See available roles (adding more daily)
- `/role software_engineer` → Full dev mode
- `/role product_manager` → Research + planning mode

### Built-in Roles

- Software Engineer (full tools: edit, shell, git)
- Product Manager (web search, planning – no code edits)
- UX Designer (research, wireframe ideas)
- Data Analyst
- Marketing Specialist
- Business Analyst
- CEO, CTO, CPO, CFO, COO
- Engineering Manager
- DevOps Engineer
- QA Manager
- Security Analyst
- Sales Representative
- HR Specialist
- And 40+ more on the way...

### Development

Prerequisites:

- [Bun](https://bun.sh) 1.3+

Install dependencies:

```bash
bun install
```

Run in development mode:

```bash
bun dev
```

Run against a different directory:

```bash
bun dev <directory>
```

Run against the titancode repo itself:

```bash
bun dev .
```

Other useful commands:

```bash
bun dev --help              # Show all available commands
bun dev serve               # Start headless API server
bun dev web                 # Start server + open web interface
bun run --cwd packages/opencode typecheck  # Type checking
```

### Building a Standalone Binary

To compile a standalone executable:

```bash
./packages/opencode/script/build.ts --single
```

Then run it with:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Replace `<platform>` with your platform (e.g., `darwin-arm64`, `linux-x64`, `windows-x64`).

### Project Structure

- `packages/opencode` - Core CLI agent and business logic
- `packages/opencode/src/cli/cmd/tui/` - TUI code (SolidJS with opentui)
- `packages/app` - Shared web UI components
- `packages/desktop` - Native desktop app (Tauri)
- `packages/plugin` - VS Code extension source

### Planned Features

- 50+ detailed job roles with custom prompts & tool permissions
- Web search tool (Tavily BYOK + free DuckDuckGo fallback)
- Custom role creation
- Multi-role sessions (PM + Engineer collaborating in tabs)
- Better support for local/weak models

### Community

Follow progress on X: [@titan_griid](https://x.com/titan_griid)

(Community Discord coming soon – suggestions welcome!)

### Contributing

Contributions are super welcome – issues, PRs, role ideas, anything! Please read the [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

Built with passion because startups deserve an AI team they can afford. Let's ship.
