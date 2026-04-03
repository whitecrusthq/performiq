import React, { useState } from "react";
import { customers, getChannelIcon, getChannelColor, Customer } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Filter, Mail, Phone, MapPin, ExternalLink, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Link } from "wouter";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">Manage your contacts and view interaction history.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button className="gap-2">
            Add Customer
          </Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between shrink-0 bg-muted/20">
          <div className="relative w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone..."
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-customers"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" /> Filters
          </Button>
        </div>
        
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Interactions</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => {
                const Icon = getChannelIcon(customer.channel);
                return (
                  <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedCustomer(customer)} data-testid={`customer-row-${customer.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={customer.avatar} />
                          <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{customer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{customer.phone}</div>
                        <div className="text-muted-foreground text-xs">{customer.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className={`h-4 w-4 ${getChannelColor(customer.channel)}`} />
                        <span className="capitalize">{customer.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {customer.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs bg-muted">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{customer.totalConversations}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(customer.lastSeen), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); }}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          {selectedCustomer && (
            <div className="mt-6 space-y-6">
              <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b">
                <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
                  <AvatarImage src={selectedCustomer.avatar} />
                  <AvatarFallback className="text-2xl">{selectedCustomer.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold">{selectedCustomer.name}</h2>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-1">
                    {React.createElement(getChannelIcon(selectedCustomer.channel), { className: `h-4 w-4 ${getChannelColor(selectedCustomer.channel)}` })}
                    Preferred: <span className="capitalize text-foreground">{selectedCustomer.channel}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Link href={`/inbox?customer=${selectedCustomer.id}`}>
                    <Button className="gap-2" data-testid="button-message-customer">
                      <MessageSquare className="h-4 w-4" /> Message
                    </Button>
                  </Link>
                  <Button variant="outline" className="gap-2">
                    Edit Profile
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Contact Info</h3>
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedCustomer.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedCustomer.email}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCustomer.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer">
                      {tag}
                    </Badge>
                  ))}
                  <Button variant="outline" size="sm" className="h-6 rounded-full text-xs">
                    + Add Tag
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Notes</h3>
                <div className="bg-muted/30 p-4 rounded-lg border text-sm">
                  {selectedCustomer.notes ? (
                    <p>{selectedCustomer.notes}</p>
                  ) : (
                    <p className="text-muted-foreground italic">No notes added yet.</p>
                  )}
                  <Button variant="link" className="px-0 h-auto text-xs mt-2">Edit Notes</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Recent Interactions</h3>
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">Conversation resolved</div>
                        <div className="text-xs text-muted-foreground mt-1">Agent Smith • {i} day{i > 1 ? 's' : ''} ago</div>
                      </div>
                      <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
