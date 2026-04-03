import React, { useState } from "react";
import { campaigns, getChannelIcon, getChannelColor } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Megaphone, Calendar, Send, BarChart2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Campaigns() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Sent</Badge>;
      case 'scheduled': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">Scheduled</Badge>;
      case 'draft': return <Badge variant="outline" className="text-muted-foreground">Draft</Badge>;
      default: return null;
    }
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Broadcast messages to your customer segments.</p>
        </div>
        
        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-new-campaign">
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Broadcast Campaign</DialogTitle>
              <DialogDescription>
                Send a mass message to your customers across channels.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input id="name" placeholder="e.g. Summer Sale 2024" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select defaultValue="whatsapp">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="facebook">Facebook Messenger</SelectItem>
                      <SelectItem value="instagram">Instagram Direct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select defaultValue="all">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      <SelectItem value="vip">VIP Segment</SelectItem>
                      <SelectItem value="active">Active in last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message Content</Label>
                <Textarea 
                  id="message" 
                  placeholder="Type your message here. Use variables like {{name}} for personalization." 
                  className="min-h-[150px] resize-none"
                />
              </div>
            </div>
            <DialogFooter className="flex justify-between sm:justify-between">
              <Button variant="outline" onClick={() => setIsNewOpen(false)}>Save Draft</Button>
              <div className="flex gap-2">
                <Button variant="secondary" className="gap-2">
                  <Calendar className="h-4 w-4" /> Schedule
                </Button>
                <Button className="gap-2" onClick={() => setIsNewOpen(false)}>
                  <Send className="h-4 w-4" /> Send Now
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8 shrink-0">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Sent</p>
              <h3 className="text-2xl font-bold">124</h3>
            </div>
            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Megaphone className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Avg Open Rate</p>
              <h3 className="text-2xl font-bold">64.2%</h3>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <BarChart2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Active Scheduled</p>
              <h3 className="text-2xl font-bold">3</h3>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <Calendar className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between shrink-0 bg-muted/20">
          <div className="relative w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-campaigns"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Open Rate</TableHead>
                <TableHead className="text-right">Click Rate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign) => {
                const Icon = getChannelIcon(campaign.channel);
                return (
                  <TableRow key={campaign.id} data-testid={`campaign-row-${campaign.id}`}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className={`h-4 w-4 ${getChannelColor(campaign.channel)}`} />
                        <span className="capitalize">{campaign.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign.sentAt ? format(new Date(campaign.sentAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">{campaign.recipients.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">
                      {campaign.status === 'sent' ? `${campaign.openRate}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {campaign.status === 'sent' ? `${campaign.clickRate}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
