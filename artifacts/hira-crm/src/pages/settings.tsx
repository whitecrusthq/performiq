import React, { useState } from "react";
import { agents, Agent } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import { CheckCircle2, ShieldAlert, Bot, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Settings() {
  const [teamList, setTeamList] = useState<Agent[]>(agents);

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your configuration has been updated successfully.",
    });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your team, channels, and AI configuration.</p>
      </div>

      <div className="grid gap-8">
        {/* Connected Channels */}
        <Card>
          <CardHeader>
            <CardTitle>Connected Channels</CardTitle>
            <CardDescription>Manage the platforms HiraCRM is listening to.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                  <SiWhatsapp className="h-5 w-5 text-[#25D366]" />
                </div>
                <div>
                  <h4 className="font-semibold">WhatsApp Business</h4>
                  <p className="text-sm text-muted-foreground">+1 (555) 019-2834</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
                  <SiFacebook className="h-5 w-5 text-[#1877F2]" />
                </div>
                <div>
                  <h4 className="font-semibold">Facebook Messenger</h4>
                  <p className="text-sm text-muted-foreground">@HiraOfficial</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-dashed rounded-lg bg-muted/20 opacity-70">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <SiInstagram className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-semibold">Instagram Direct</h4>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button variant="secondary" size="sm">Connect Account</Button>
            </div>
          </CardContent>
        </Card>

        {/* AI & Automation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> AI & Automation
            </CardTitle>
            <CardDescription>Configure how the AI bot handles incoming messages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">First-line Deflection Bot</Label>
                <p className="text-sm text-muted-foreground">Automatically attempt to resolve queries before routing to human agents.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="space-y-4">
              <Label>Bot Personality Tone</Label>
              <Select defaultValue="professional">
                <SelectTrigger className="w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional & Direct</SelectItem>
                  <SelectItem value="friendly">Friendly & Casual</SelectItem>
                  <SelectItem value="empathetic">Empathetic & Supportive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4">
              <Label>Auto-escalation Threshold</Label>
              <div className="text-sm text-muted-foreground mb-2">Escalate to human if sentiment score drops below:</div>
              <div className="flex items-center gap-4">
                <input type="range" min="1" max="100" defaultValue="40" className="w-[300px] accent-primary" />
                <span className="font-medium text-sm">40%</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/20 px-6 py-4">
            <Button onClick={handleSave} data-testid="button-save-ai-settings">Save Automation Settings</Button>
          </CardFooter>
        </Card>

        {/* Team Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>Add agents and manage their roles.</CardDescription>
            </div>
            <Button size="sm" data-testid="button-add-agent">Add Agent</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamList.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={agent.avatar} />
                      <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-sm text-muted-foreground">{agent.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Select defaultValue={agent.role}>
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
