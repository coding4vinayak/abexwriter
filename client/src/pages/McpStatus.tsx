import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Server, Plug, AlertCircle } from "lucide-react";

interface McpServerInfo {
  name: string;
  url: string;
  status: "connected" | "disconnected" | "error";
  tools: { name: string; description: string }[];
}

interface McpStatusResponse {
  configured: boolean;
  servers: McpServerInfo[];
  message: string;
}

export default function McpStatus() {
  const { data, isLoading, error } = useQuery<McpStatusResponse>({
    queryKey: ["/api/mcp/status"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/mcp/status", undefined);
      return r.json();
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MCP Integration</h1>
        <p className="text-muted-foreground mt-1">
          Model Context Protocol servers extend AbexWriter with external tools and data sources.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking MCP status...
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to check MCP status</span>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                Status
              </CardTitle>
              <CardDescription>{data.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={data.configured ? "default" : "secondary"}>
                  {data.configured ? "Configured" : "Not Configured"}
                </Badge>
                {!data.configured && (
                  <span className="text-sm text-muted-foreground">
                    Set <code className="bg-muted px-1 rounded">MCP_SERVERS</code> environment variable to enable.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {data.configured && data.servers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Servers ({data.servers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.servers.map((server) => (
                    <div
                      key={server.name}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div>
                        <p className="font-medium">{server.name}</p>
                        <p className="text-sm text-muted-foreground">{server.url}</p>
                      </div>
                      <Badge
                        variant={
                          server.status === "connected"
                            ? "default"
                            : server.status === "error"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {server.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!data.configured && (
            <Card>
              <CardHeader>
                <CardTitle>Configuration Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  To enable MCP integration, add the following to your <code className="bg-muted px-1 rounded">.env</code> file:
                </p>
                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`MCP_SERVERS='[{"name":"my-server","url":"http://localhost:3100"}]'`}
                </pre>
                <p className="text-sm text-muted-foreground">
                  Each MCP server must implement the Model Context Protocol. Once configured,
                  tools from these servers will be available for use in chapter generation,
                  research, and other AI-powered features.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
