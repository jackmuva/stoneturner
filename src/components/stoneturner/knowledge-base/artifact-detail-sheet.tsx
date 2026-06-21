import ReactMarkdown, { type Components } from "react-markdown";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MdArtifactSelect } from "@/core/db/schema/schema";
import { configRegistry } from "@/integrations/config-registry";

export const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-6 mb-3 text-xl font-semibold text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-2 text-lg font-semibold text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 text-base font-semibold text-foreground first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-2 text-sm leading-relaxed text-foreground">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-foreground marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1 text-sm text-foreground marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border pl-4 text-sm italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8em] text-foreground">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-md bg-muted p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-4 border-border" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-3 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-1.5 align-top">{children}</td>
  ),
};

const Markdown = ({ content }: { content: string }) => {
  if (!content.trim()) {
    return <div className="text-sm text-muted-foreground">Nothing here yet.</div>;
  }
  return (
    <div className="max-w-none">
      <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  );
};

export const ArtifactDetailSheet = ({
  artifact,
  onClose,
}: {
  artifact: MdArtifactSelect | null;
  onClose: () => void;
}) => {
  if (!artifact) return null;

  const intConfig = configRegistry.find((c) => c.integration === artifact.integration);

  const markdown = (artifact.markdown ?? "").replace(/\\n/g, "\n");
  const keyPoints = (artifact.keyPoints ?? []).map((k) => `- ${k}`).join("\n");
  const questionsAnswered = (artifact.questionsAnswered ?? []).map((q) => `- ${q}`).join("\n");

  return (
    <div className="h-full min-h-0 w-1/2 flex flex-col border rounded-xs overflow-hidden bg-background">
      <div className="flex flex-col gap-2 p-4 border-b">
        <div className="flex items-center gap-2">
          {intConfig && (
            <img src={intConfig.icon} alt={intConfig.integration} height={24} width={24} />
          )}
          <span className="font-semibold text-foreground">{artifact.integration}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={onClose}
          >
            <XIcon size={16} />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span>
            Updated: <span className="tabular-nums">{new Date(artifact.updateDate).toLocaleString()}</span>
          </span>
          <span>
            Artifact date:{" "}
            <span className="tabular-nums">
              {artifact.artifactDate ? new Date(artifact.artifactDate).toDateString() : "n/a"}
            </span>
          </span>
        </div>
      </div>

      <Tabs defaultValue="markdown" className="flex-1 min-h-0 flex flex-col gap-2 p-4">
        <TabsList className="w-full">
          <TabsTrigger value="markdown">Markdown</TabsTrigger>
          <TabsTrigger value="keyPoints">Key Points</TabsTrigger>
          <TabsTrigger value="questionsAnswered">Questions Answered</TabsTrigger>
        </TabsList>
        <TabsContent value="markdown" className="min-h-0 flex-1 overflow-auto">
          <Markdown content={markdown} />
        </TabsContent>
        <TabsContent value="keyPoints" className="min-h-0 flex-1 overflow-auto">
          <Markdown content={keyPoints} />
        </TabsContent>
        <TabsContent value="questionsAnswered" className="min-h-0 flex-1 overflow-auto">
          <Markdown content={questionsAnswered} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
