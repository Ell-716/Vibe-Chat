import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Ticket, 
  Users, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Plus,
  TrendingUp,
  MessageSquare,
  RefreshCw,
  User,
  Mail,
  Sparkles
} from "lucide-react";
import { Link } from "wouter";
import type { SupportTicket, SupportAgent, TicketCategory, TicketPriority, TicketStatus } from "@shared/schema";
import TicketDetail from "@/components/ticket-detail";

const priorityColors: Record<TicketPriority, string> = {
  low: "bg-slate-500",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const statusColors: Record<TicketStatus, string> = {
  open: "bg-green-500",
  in_progress: "bg-blue-500",
  pending_customer: "bg-yellow-500",
  escalated: "bg-red-500",
  resolved: "bg-slate-500",
  closed: "bg-slate-400",
};

interface TicketStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  escalatedTickets: number;
  resolvedToday: number;
  averageResponseTime: number;
  agentsOnline: number;
  totalAgents: number;
  slaBreaches: number;
  ticketsByCategory: Record<string, number>;
  ticketsByPriority: Record<string, number>;
}

export default function SupportPage() {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
  });

  const { data: agents = [] } = useQuery<SupportAgent[]>({
    queryKey: ["/api/support/agents"],
  });

  const { data: stats } = useQuery<TicketStats>({
    queryKey: ["/api/support/stats"],
    refetchInterval: 30000,
  });

  const checkEscalationsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/support/check-escalations");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/stats"] });
      toast({
        title: "Escalation check complete",
        description: `${data.escalatedCount} ticket(s) were escalated`,
      });
    },
  });

  const filteredTickets = statusFilter === "all" 
    ? tickets 
    : tickets.filter(t => t.status === statusFilter);

  if (ticketsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className={`flex-1 p-6 overflow-auto ${selectedTicket ? 'hidden md:block md:w-1/2 lg:w-2/5' : ''}`}>
        <Link href="/">
          <button
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity mb-6"
            data-testid="button-back-to-chat"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[#00a896]">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">Vibe Chat</span>
          </button>
        </Link>

        <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
          <h1 className="text-2xl font-bold">Support Dashboard</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => checkEscalationsMutation.mutate()}
              disabled={checkEscalationsMutation.isPending}
              data-testid="button-check-escalations"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Check Escalations
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-ticket">
                  <Plus className="w-4 h-4 mr-2" />
                  New Ticket
                </Button>
              </DialogTrigger>
              <CreateTicketDialog onClose={() => setIsCreateOpen(false)} />
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold" data-testid="text-open-tickets">{stats?.openTickets || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold" data-testid="text-in-progress-tickets">{stats?.inProgressTickets || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Escalated</p>
                  <p className="text-2xl font-bold" data-testid="text-escalated-tickets">{stats?.escalatedTickets || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Agents Online</p>
                  <p className="text-2xl font-bold" data-testid="text-agents-online">{stats?.agentsOnline || 0}/{stats?.totalAgents || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 mb-4 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tickets</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="pending_customer">Pending Customer</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tickets found</p>
                <p className="text-sm mt-2">Create a new ticket to get started</p>
              </CardContent>
            </Card>
          ) : (
            filteredTickets.map((ticket) => (
              <Card 
                key={ticket.id} 
                className={`cursor-pointer hover-elevate ${selectedTicket?.id === ticket.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedTicket(ticket)}
                data-testid={`card-ticket-${ticket.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={priorityColors[ticket.priority]} data-testid={`badge-priority-${ticket.id}`}>
                          {ticket.priority}
                        </Badge>
                        <Badge variant="outline" className={`${statusColors[ticket.status]} text-white`} data-testid={`badge-status-${ticket.id}`}>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                        <Badge variant="secondary" data-testid={`badge-category-${ticket.id}`}>
                          {ticket.category.replace("_", " ")}
                        </Badge>
                      </div>
                      <h3 className="font-medium truncate" data-testid={`text-ticket-subject-${ticket.id}`}>{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground truncate">{ticket.customerName} - {ticket.customerEmail}</p>
                      {ticket.aiSummary && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.aiSummary}</p>
                      )}
                    </div>
                    <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                      <p>{new Date(ticket.createdAt).toLocaleDateString()}</p>
                      {ticket.assignedAgentId && (
                        <p className="flex items-center gap-1 justify-end mt-1">
                          <User className="w-3 h-3" />
                          {agents.find(a => a.id === ticket.assignedAgentId)?.name || "Assigned"}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {selectedTicket && (
        <div className="flex-1 border-l md:w-1/2 lg:w-3/5">
          <TicketDetail 
            ticket={selectedTicket} 
            agents={agents}
            onClose={() => setSelectedTicket(null)}
            onUpdate={(updated: SupportTicket) => setSelectedTicket(updated)}
          />
        </div>
      )}
    </div>
  );
}

function CreateTicketDialog({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [category, setCategory] = useState<TicketCategory>("general");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/support/tickets", data);
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/stats"] });
      toast({
        title: "Ticket created",
        description: `Ticket routed to ${result.assignedAgent?.name || "queue"}. AI suggested: ${result.analysis?.category} / ${result.analysis?.priority}`,
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create ticket",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      subject,
      description,
      customerName,
      customerEmail,
      category,
      priority,
    });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Create Support Ticket</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Customer Name</label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Doe"
              required
              data-testid="input-customer-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Customer Email</label>
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="john@example.com"
              required
              data-testid="input-customer-email"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of the issue"
            required
            data-testid="input-ticket-subject"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the issue..."
            rows={4}
            required
            data-testid="input-ticket-description"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
              <SelectTrigger data-testid="select-ticket-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="account">Account</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="bug_report">Bug Report</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Priority</label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
              <SelectTrigger data-testid="select-ticket-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-ticket">
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-ticket">
            {createMutation.isPending ? "Creating..." : "Create Ticket"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
