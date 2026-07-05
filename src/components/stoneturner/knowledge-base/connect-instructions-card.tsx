import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export const ConnectInstructionsCard = () => {
  return (
    <Card className='flex flex-col col-span-full'>
      <Tabs defaultValue="claude-code">
        <CardHeader className='flex sm:flex-row flex-col sm:items-center overflow-x-auto'>
          <CardTitle>Connect to</CardTitle>
          <TabsList variant={"line"} className=''>
            <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
            <TabsTrigger value="codex">Codex</TabsTrigger>
            <TabsTrigger value="opencode">OpenCode</TabsTrigger>
            <TabsTrigger value="cursor">Cursor</TabsTrigger>
            <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
            <TabsTrigger value="claude-web">Claude Web</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="claude-code" className="flex flex-col gap-3">
            <CodeBlock label="Claude CLI"
              code={`claude mcp add --transport http stoneturner ${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/mcp`}
            />
          </TabsContent>
          <TabsContent value="codex" className="flex flex-col gap-3">
            <CodeBlock label="config.toml"
              code={`[mcp_servers.stoneturner]
url = "${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/mcp"`}
            />
          </TabsContent>
          <TabsContent value="opencode" className="flex flex-col gap-3">
            <CodeBlock label=".config/opencode/opencode.jsonc"
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
          <TabsContent value="cursor" className="flex flex-col gap-3">
            <CodeBlock label=".cursor/mcp.json"
              code={`{
  "mcpServers": {
    "stoneturner": {
      "url": "http://app.stoneturner.app/mcp"
    }
  }
}`}
            />
          </TabsContent>
          <TabsContent value="chatgpt" className="flex flex-col gap-3">
            <ol>
              <li>1. Go to&nbsp;
                <a href='https://chatgpt.com/apps#settings/Connectors' target='_blank' className='underline'>
                  ChatGPT's App Settings
                </a>
              </li>
              <li>2. Enable <strong>Developer Mode</strong></li>
              <li>3. Create an app and make sure "Authentication" is set to <strong>OAuth</strong></li>
              <li>4. Under "Connection" set it to:</li>
              <CodeBlock label="Connection" code='https://app.stoneturner.app/mcp' />
            </ol>
          </TabsContent>
          <TabsContent value="claude-web" className="flex flex-col gap-3">
            <ol>
              <li>1. Go to&nbsp;
                <a href='https://claude.ai/customize/connectors?modal=add-custom-connector' target='_blank' className='underline'>
                  Claude's Add Custom Connector
                </a>
              </li>
              <li>2. Give the connector a name (i.e. Stoneturner)</li>
              <li>3. Under "Remote MCP Server URL" set it to:</li>
              <CodeBlock label="MCP URL" code='https://app.stoneturner.app/mcp' />
            </ol>
          </TabsContent>
        </CardContent>
      </Tabs>
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
    <div className="relative flex flex-col gap-1">
      <div className='flex justify-between w-full items-center'>
        {label && (
          <div className="text-xs text-muted-foreground font-mono">{label}</div>
        )}
        <Button type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="size-7"
          aria-label="Copy code" >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
      <div className="relative rounded-md border bg-muted">
        <pre className="overflow-x-auto p-3 pr-10 text-xs">
          <code className="font-mono whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
};


