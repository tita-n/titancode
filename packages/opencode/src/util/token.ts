export namespace Token {
  const CHARS_PER_TOKEN = 4
  const CODE_CHARS_PER_TOKEN = 3.5

  export function estimate(input: string): number {
    if (!input) return 0

    const isCode = /[{}();]/.test(input) || input.includes("function ") || input.includes("const ") || input.includes("import ")

    const charsPerToken = isCode ? CODE_CHARS_PER_TOKEN : CHARS_PER_TOKEN

    return Math.max(0, Math.round(input.length / charsPerToken))
  }
}
