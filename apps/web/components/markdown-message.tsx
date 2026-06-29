import { clsx } from "clsx";
import type { ReactNode } from "react";

type MarkdownBlock =
  | { type: "code"; language: string | null; content: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; content: string };

export function MarkdownMessage({ content, inverted = false }: { content: string; inverted?: boolean }) {
  return (
    <div className="space-y-3">
      {parseBlocks(content).map((block, index) => {
        if (block.type === "code") {
          return <CodeBlock block={block} key={index} />;
        }
        if (block.type === "list") {
          return (
            <ul className={clsx("list-disc space-y-1 pl-5", inverted ? "text-white/90 dark:text-black/80" : "text-black/75 dark:text-white/75")} key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineMarkdown content={item} inverted={inverted} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p className="whitespace-pre-wrap" key={index}>
            <InlineMarkdown content={block.content} inverted={inverted} />
          </p>
        );
      })}
    </div>
  );
}

function CodeBlock({ block }: { block: Extract<MarkdownBlock, { type: "code" }> }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-neutral-950 text-neutral-100">
      {block.language ? <div className="border-b border-white/10 px-3 py-1.5 text-[11px] uppercase tracking-normal text-white/45">{block.language}</div> : null}
      <pre className="overflow-x-auto p-3 text-[12px] leading-5">
        <code>{highlightCode(block.content || " ", block.language)}</code>
      </pre>
    </div>
  );
}

function InlineMarkdown({ content, inverted }: { content: string; inverted: boolean }) {
  const parts = content.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
          return (
            <code className={clsx("rounded-md px-1.5 py-0.5 text-[0.92em]", inverted ? "bg-white/15 dark:bg-black/10" : "bg-black/5 dark:bg-white/10")} key={index}>
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function parseBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let code: { language: string | null; lines: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", content: paragraph.join("\n") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  };

  for (const line of lines) {
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      if (code) {
        blocks.push({ type: "code", language: code.language, content: code.lines.join("\n") });
        code = null;
      } else {
        flushParagraph();
        flushList();
        code = { language: fence[1] || null, lines: [] };
      }
      continue;
    }

    if (code) {
      code.lines.push(line);
      continue;
    }

    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]!);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  if (code) {
    blocks.push({ type: "code", language: code.language, content: code.lines.join("\n") });
  }
  flushParagraph();
  flushList();

  return blocks.length ? blocks : [{ type: "paragraph", content: "" }];
}

const keywordPattern = /\b(?:async|await|break|case|catch|class|const|continue|def|else|export|extends|false|finally|for|from|function|if|import|in|interface|let|null|return|throw|true|try|type|var|while)\b/;
const keywordSplitPattern = /(\b(?:async|await|break|case|catch|class|const|continue|def|else|export|extends|false|finally|for|from|function|if|import|in|interface|let|null|return|throw|true|try|type|var|while)\b)/g;

function highlightCode(code: string, language: string | null): ReactNode[] {
  const pieces = code.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*|(^|\s)#.*)/gm);
  return pieces.map((piece, index) => {
    if (!piece) {
      return null;
    }
    if (/^["'`]/.test(piece)) {
      return (
        <span className="text-emerald-300" key={index}>
          {piece}
        </span>
      );
    }
    if (piece.startsWith("//") || piece.startsWith("#")) {
      return (
        <span className="text-white/40" key={index}>
          {piece}
        </span>
      );
    }
    return (
      <span key={index}>
        {piece.split(keywordSplitPattern).map((part, partIndex) =>
          keywordPattern.test(part) ? (
            <span className="text-sky-300" key={partIndex}>
              {part}
            </span>
          ) : (
            <span key={partIndex}>{part}</span>
          )
        )}
      </span>
    );
  });
}
