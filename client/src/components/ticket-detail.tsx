import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  X, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  User,
  Clock,
  CheckCircle2,
  MessageSquare,
  RefreshCw
} from "lucide-react";
import type { SupportTicket, SupportAgent, TicketMessage, TicketStatus, TicketPriority } from "@shared/schema";

interface TicketDetailProps {
  ticket: SupportTicket;
  agents: SupportAgent[];
  onClose: () => void;
  onUpdate: (ticket: SupportTicket) => void;
}

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

interface TicketWithMessages extends SupportTicket {
  messages: TicketMessage[];
}

export default function TicketDetail({ ticket, agents, onClose, onUpdate }: TicketDetailProps) {
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const { toast } = useToast();

  const { data: ticketData, isLoading } = useQuery<TicketWithMessages>({
    queryKey: ["/api/support/tickets", ticket.id],
    refetchInterval: 10000,
  });

  const messages = ticketData?.messages || [];

  const updateStatusMutation = useMutation({
    mutationFn: async (status: TicketStatus) => {
      const res = await apiRequest("PATCH", `/api/support/tickets/${ticket.id}`, { status });
      return res.json();
    },
    onSuccess: (updated: SupportTicket) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/stats"] });
      onUpdate(updated);
      toast({ title: "Status updated" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest("POST", `/api/support/tickets/${ticket.id}/assign`, { agentId });
      return res.json();
    },
    onSuccess: (updated: SupportTicket) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/agents"] });
      onUpdate(updated);
      toast({ title: "Ticket assigned" });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/tickets/${ticket.id}/escalate`, { reason: "Manual escalation by agent" });
      return res.json();
    },
    onSuccess: (updated: SupportTicket) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/stats"] });
      onUpdate(updated);
      toast({ title: "Ticket escalated", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/support/tickets/${ticket.id}/messages`, {
        content,
        senderId: ticket.assignedAgentId || "agent-1",
        senderType: "agent",
        isInternal,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticket.id] });
      setNewMessage("");
      toast({ title: "Message sent" });
    },
  });

  const generateResponseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/tickets/${ticket.id}/generate-response`);
      return res.json();
    },
    onSuccess: (data: { suggestedResponse: string }) => {
      setNewMessage(data.suggestedResponse);
      toast({ title: "AI response generated" });
    },
  });

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      sendMessageMutation.mutate(newMessage.trim());
    }
  };

  const assignedAgent = agents.find(a => a.id === ticket.assignedAgentId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b gap-2">
        <h2 className="font-semibold truncate" data-testid="text-detail-subject">{ticket.subject}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-detail">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ticket Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className={priorityColors[ticket.priority]} data-testid="badge-detail-priority">
                {ticket.priority}
              </Badge>
              <Badge variant="outline" className={`${statusColors[ticket.status]} text-white`} data-testid="badge-detail-status">
                {ticket.status.replace("_", " ")}
              </Badge>
              <Badge variant="secondary" data-testid="badge-detail-category">
                {ticket.category.replace("_", " ")}
              </Badge>
              {ticket.escalationLevel > 0 && (
                <Badge variant="destructive" data-testid="badge-escalation-level">
                  Escalation Level {ticket.escalationLevel}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium" data-testid="text-detail-customer">{ticket.customerName}</p>
                <p className="text-muted-foreground">{ticket.customerEmail}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{new Date(ticket.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {ticket.slaDeadline && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>SLA Deadline: {new Date(ticket.slaDeadline).toLocaleString()}</span>
                {new Date(ticket.slaDeadline) < new Date() && ticket.status !== "resolved" && ticket.status !== "closed" && (
                  <Badge variant="destructive">SLA Breached</Badge>
                )}
              </div>
            )}

            {ticket.aiSummary && (
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Summary
                </div>
                <p className="text-sm" data-testid="text-ai-summary">{ticket.aiSummary}</p>
              </div>
            )}

            {ticket.tags && ticket.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {ticket.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                <Select 
                  value={ticket.status} 
                  onValueChange={(v) => updateStatusMutation.mutate(v as TicketStatus)}
                  disabled={updateStatusMutation.isPending}
                >
                  <SelectTrigger data-testid="select-detail-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="pending_customer">Pending Customer</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Assign To</label>
                <Select 
                  value={ticket.assignedAgentId || "unassigned"} 
                  onValueChange={(v) => v !== "unassigned" && assignMutation.mutate(v)}
                  disabled={assignMutation.isPending}
                >
                  <SelectTrigger data-testid="select-assign-agent">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({agent.currentTicketCount}/{agent.maxTickets})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full"
              onClick={() => escalateMutation.mutate()}
              disabled={escalateMutation.isPending || ticket.status === "escalated"}
              data-testid="button-escalate"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Escalate Ticket
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Conversation</CardTitle>
              <Badge variant="secondary">{messages.length} messages</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-auto">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`p-3 rounded-lg ${
                      msg.senderType === "customer" 
                        ? "bg-muted" 
                        : msg.senderType === "system"
                        ? "bg-yellow-500/10 border border-yellow-500/20"
                        : msg.isInternal 
                        ? "bg-orange-500/10 border border-orange-500/20" 
                        : "bg-primary/10"
                    }`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {msg.senderType === "customer" ? (
                        <User className="w-3 h-3" />
                      ) : msg.senderType === "system" ? (
                        <AlertTriangle className="w-3 h-3 text-yellow-500" />
                      ) : (
                        <MessageSquare className="w-3 h-3 text-primary" />
                      )}
                      <span className="text-xs font-medium">
                        {msg.senderType === "customer" ? ticket.customerName : 
                         msg.senderType === "system" ? "System" :
                         assignedAgent?.name || "Agent"}
                      </span>
                      {msg.isInternal && (
                        <Badge variant="outline" className="text-xs">Internal</Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 border-t space-y-3">
        {ticket.aiSuggestedResponse && !newMessage && (
          <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              AI Suggested Response
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{ticket.aiSuggestedResponse}</p>
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 h-auto mt-1"
              onClick={() => setNewMessage(ticket.aiSuggestedResponse!)}
              data-testid="button-use-ai-suggestion"
            >
              Use this response
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <Button
            variant={isInternal ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsInternal(!isInternal)}
            data-testid="button-toggle-internal"
          >
            {isInternal ? "Internal Note" : "Customer Reply"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateResponseMutation.mutate()}
            disabled={generateResponseMutation.isPending}
            data-testid="button-generate-response"
          >
            {generateResponseMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1" />
                Generate AI Response
              </>
            )}
          </Button>
        </div>

        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isInternal ? "Add internal note..." : "Reply to customer..."}
            rows={3}
            className="resize-none"
            data-testid="input-reply-message"
          />
        </div>
        <Button 
          className="w-full" 
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || sendMessageMutation.isPending}
          data-testid="button-send-reply"
        >
          <Send className="w-4 h-4 mr-2" />
          {sendMessageMutation.isPending ? "Sending..." : isInternal ? "Add Note" : "Send Reply"}
        </Button>
      </div>
    </div>
  );
}
