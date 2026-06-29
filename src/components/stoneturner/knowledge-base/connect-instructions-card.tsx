import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export const ConnectInstructionsCard = () => {
  return (
    <Card className='flex flex-col col-span-3'>
      <CardHeader>
        <CardTitle>Connect to Stoneturner</CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure an HTTP-based MCP in your agent config
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="claude-code">
          <TabsList>
            <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
            <TabsTrigger value="codex">Codex</TabsTrigger>
            <TabsTrigger value="opencode">OpenCode</TabsTrigger>
          </TabsList>
          <TabsContent value="claude-code" className="flex flex-col gap-3">
            <CodeBlock
              label="Claude CLI"
              code={`claude mcp add --transport http stoneturner ${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/mcp`}
            />
            <CodeBlock
              label=".mcp.json — manual add"
              code={`{
  "mcpServers": {
    "stoneturner": {
      "type": "remote",
      "url": "${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/mcp"
    }
  }
}`}
            />
          </TabsContent>
          <TabsContent value="codex" className="flex flex-col gap-3">
            <CodeBlock
              label="config.toml"
              code={`[mcp_servers.stoneturner]
url = "${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/mcp"`}
            />
          </TabsContent>
          <TabsContent value="opencode" className="flex flex-col gap-3">
            <CodeBlock
              label=".config/opencode/opencode.jsonc"
              code={`{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "stoneturner": {
      "type": "remote",
      "url": ${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/mcp",
      "enabled": true
    }
  }
}`}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

  );
}

const CodeBlock = ({ label, code }: { label?: string; code: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      {label && (
        <div className="text-xs text-muted-foreground font-mono mb-1">{label}</div>
      )}
      <div className="relative rounded-md border bg-muted">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="absolute top-1.5 right-1.5 size-7"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
        <pre className="overflow-x-auto p-3 pr-10 text-xs">
          <code className="font-mono whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
};


