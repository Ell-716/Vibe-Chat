import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Bot, Code, PenTool, BarChart, GraduationCap, Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent } from "@shared/schema";

interface AgentSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent) => void;
}

const iconOptions = [
  { value: "bot", label: "Bot", Icon: Bot },
  { value: "code", label: "Code", Icon: Code },
  { value: "pen-tool", label: "Writer", Icon: PenTool },
  { value: "bar-chart", label: "Chart", Icon: BarChart },
  { value: "graduation-cap", label: "Education", Icon: GraduationCap },
];

const iconMap: Record<string, typeof Bot> = {
  bot: Bot,
  code: Code,
  "pen-tool": PenTool,
  "bar-chart": BarChart,
  "graduation-cap": GraduationCap,
};

export function AgentSettingsModal({ open, onOpenChange, agents, selectedAgent, onSelectAgent }: AgentSettingsModalProps) {
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    icon: "bot",
  });

  const createAgentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/agents", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      resetForm();
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Agent> }) => {
      const res = await apiRequest("PATCH", `/api/agents/${id}`, data);
      return res.json();
    },
    onSuccess: (updatedAgent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      if (selectedAgent?.id === updatedAgent.id) {
        onSelectAgent(updatedAgent);
      }
      resetForm();
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  const resetForm = () => {
    setEditingAgent(null);
    setIsCreating(false);
    setFormData({ name: "", description: "", systemPrompt: "", icon: "bot" });
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setIsCreating(false);
    setFormData({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      icon: agent.icon,
    });
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingAgent(null);
    setFormData({ name: "", description: "", systemPrompt: "", icon: "bot" });
  };

  const handleSave = () => {
    if (editingAgent) {
      updateAgentMutation.mutate({ id: editingAgent.id, data: formData });
    } else if (isCreating) {
      createAgentMutation.mutate(formData);
    }
  };

  const handleDelete = (agent: Agent) => {
    if (!agent.isDefault) {
      deleteAgentMutation.mutate(agent.id);
    }
  };

  const getIcon = (iconName: string) => {
    return iconMap[iconName] || Bot;
  };

  const isEditing = editingAgent !== null || isCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? (editingAgent ? "Edit Agent" : "Create New Agent") : "Manage Agents"}
          </DialogTitle>
        </DialogHeader>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Agent name"
                  className="bg-card border-border text-foreground"
                  data-testid="input-agent-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Icon</label>
                <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                  <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-agent-icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-popover-border">
                    {iconOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                      >
                        <span className="flex items-center gap-2">
                          <option.Icon className="h-4 w-4" />
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the agent"
                className="bg-card border-border text-foreground"
                data-testid="input-agent-description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">System Prompt</label>
              <Textarea
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder="Instructions that define how the agent behaves..."
                className="bg-card border-border text-foreground min-h-[150px]"
                data-testid="textarea-agent-prompt"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="ghost"
                onClick={resetForm}
                data-testid="button-cancel-agent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.name || !formData.systemPrompt}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-save-agent"
              >
                {editingAgent ? "Save Changes" : "Create Agent"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2">
              {agents.map((agent) => {
                const Icon = getIcon(agent.icon);
                return (
                  <div
                    key={agent.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${
                      selectedAgent?.id === agent.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <Icon className={`h-6 w-6 mt-0.5 ${selectedAgent?.id === agent.id ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{agent.name}</span>
                        {agent.isDefault && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Default</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleEditAgent(agent)}
                        data-testid={`button-edit-agent-${agent.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {!agent.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(agent)}
                          data-testid={`button-delete-agent-${agent.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              onClick={handleCreateNew}
              variant="outline"
              className="w-full border-dashed"
              data-testid="button-create-agent"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Agent
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
