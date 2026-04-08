import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MessageSquare,
  Bot,
  LayoutDashboard,
  Briefcase,
  AlertTriangle,
  Grid3X3,
  Settings,
  FileText,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  Mic,
  Send,
  Sparkles,
  Compass,
  Rocket,
  Image,
  FolderPlus,
  Github,
  Zap,
  Link2,
  Puzzle,
  Globe,
  Palette,
  Check,
  X,
  Pencil,
  Copy,
  Info,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Model providers data
const MODEL_PROVIDERS = {
  anthropic: {
    name: "anthropic",
    models: [
      { id: "claude-3-opus", name: "claude-3-opus", context: "200K", speed: "slow", quality: "best" },
      { id: "claude-3-sonnet", name: "claude-3-sonnet", context: "200K", speed: "fast", quality: "great" },
      { id: "claude-3-haiku", name: "claude-3-haiku", context: "200K", speed: "fastest", quality: "good" },
    ],
  },
  cognitivecomputations: {
    name: "cognitivecomputations",
    models: [
      { id: "dolphin-mixtral", name: "dolphin-mixtral-8x7b", context: "32K", speed: "fast", quality: "good" },
    ],
  },
  deepseek: {
    name: "deepseek",
    models: [
      { id: "deepseek-coder", name: "deepseek-coder-33b", context: "16K", speed: "fast", quality: "good" },
      { id: "deepseek-chat", name: "deepseek-chat", context: "32K", speed: "fast", quality: "good" },
    ],
  },
  "deepseek-ai": {
    name: "deepseek-ai",
    models: [
      { id: "deepseek-v2", name: "deepseek-v2", context: "128K", speed: "fast", quality: "great" },
    ],
  },
  google: {
    name: "google",
    models: [
      { id: "gemini-pro", name: "gemini-pro", context: "32K", speed: "fast", quality: "great" },
      { id: "gemini-ultra", name: "gemini-ultra", context: "32K", speed: "medium", quality: "best" },
    ],
  },
  "meta-llama": {
    name: "meta-llama",
    models: [
      { id: "llama-3-70b", name: "llama-3-70b-instruct", context: "8K", speed: "fast", quality: "great" },
      { id: "llama-3-8b", name: "llama-3-8b-instruct", context: "8K", speed: "fastest", quality: "good" },
    ],
  },
  minimax: {
    name: "minimax",
    models: [
      { id: "abab6-chat", name: "abab6-chat", context: "32K", speed: "fast", quality: "good" },
    ],
  },
  moonshot: {
    name: "moonshot",
    models: [
      { id: "moonshot-v1", name: "moonshot-v1-128k", context: "128K", speed: "fast", quality: "good" },
    ],
  },
  nvidia: {
    name: "nvidia",
    models: [
      { id: "nemotron-3-super-120b-a12b", name: "nemotron-3-super-120b-a12b", context: "128K", speed: "medium", quality: "best" },
      { id: "nemotron-3-super-120b-a12b-free", name: "nemotron-3-super-120b-a12b:free", provider: "nvidia/nemotron-3-super-120b-a12b:free", context: "262K", speed: "fast", quality: "great" },
      { id: "nemotron-nano-12b-v2-vl-free", name: "nemotron-nano-12b-v2-vl:free", provider: "nvidia/nemotron-nano-12b-v2-vl:free", context: "128K", speed: "fastest", quality: "good" },
      { id: "nemotron-nano-8b-v2-free", name: "nemotron-nano-8b-v2:free", provider: "nvidia/nemotron-nano-8b-v2:free", context: "128K", speed: "fastest", quality: "good" },
    ],
  },
  openai: {
    name: "openai",
    models: [
      { id: "gpt-4-turbo", name: "gpt-4-turbo", context: "128K", speed: "medium", quality: "best" },
      { id: "gpt-4o", name: "gpt-4o", context: "128K", speed: "fast", quality: "best" },
      { id: "gpt-4o-mini", name: "gpt-4o-mini", context: "128K", speed: "fastest", quality: "great" },
      { id: "gpt-3.5-turbo", name: "gpt-3.5-turbo", context: "16K", speed: "fastest", quality: "good" },
      { id: "o1-preview", name: "o1-preview", context: "128K", speed: "slow", quality: "best" },
    ],
  },
  openrouter: {
    name: "openrouter",
    models: [
      { id: "auto", name: "auto", context: "varies", speed: "varies", quality: "varies" },
    ],
  },
};

// Skills data
const SKILLS = [
  { id: "deep-research", name: "deep-research", icon: Search },
  { id: "code-review", name: "code-review", icon: FileText },
  { id: "web-scraper", name: "web-scraper", icon: Globe },
  { id: "file-manager", name: "file-manager", icon: FolderPlus },
  { id: "task-scheduler", name: "task-scheduler", icon: Briefcase },
  { id: "mcp-builder", name: "mcp-builder", icon: Puzzle },
  { id: "slack-gif-creator", name: "slack-gif-creator", icon: Image },
  { id: "canvas-design", name: "canvas-design", icon: Palette },
];

// Writing styles
const WRITING_STYLES = [
  { id: "normal", name: "Normal" },
  { id: "concise", name: "Concise" },
  { id: "formal", name: "Formal" },
  { id: "explanatory", name: "Explanatory" },
];

function App() {
  const [activeNav, setActiveNav] = useState("chat");
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState("normal");
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [agentMode, setAgentMode] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [conversations, setConversations] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [bookmarksOpen, setBookmarksOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [scheduledEnabled, setScheduledEnabled] = useState(false);

  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await axios.get(`${API}/conversations`);
        setConversations(response.data);
      } catch (e) {
        console.log("No conversations endpoint yet");
        // Mock data for demonstration
        setConversations([
          { id: "1", title: "New conversation", timestamp: new Date() },
          { id: "2", title: "New conversation", timestamp: new Date() },
          { id: "3", title: "New conversation", timestamp: new Date() },
          { id: "4", title: "New conversation", timestamp: new Date() },
          { id: "5", title: "hello", timestamp: new Date() },
          { id: "6", title: "hi", timestamp: new Date() },
          { id: "7", title: "hello", timestamp: new Date() },
        ]);
      }
      setIsConnecting(false);
    };
    fetchConversations();
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim()) return;
    console.log("Sending:", inputValue, "with model:", selectedModel);
    setInputValue("");
  }, [inputValue, selectedModel]);

  const handleSkillToggle = (skillId) => {
    setSelectedSkills(prev => 
      prev.includes(skillId) 
        ? prev.filter(s => s !== skillId)
        : [...prev, skillId]
    );
  };

  const navItems = [
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "agent", icon: Bot, label: "Agent" },
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "jobs", icon: Briefcase, label: "Jobs" },
    { id: "approvals", icon: AlertTriangle, label: "Approvals", badge: 2 },
    { id: "spaces", icon: Grid3X3, label: "Spaces" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  const bookmarks = [
    { id: "config", icon: FileText, label: "Config + logs" },
    { id: "setup", icon: FileText, label: "Setting Up OpenClaw Wi..." },
  ];

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-[#0a0a0f] text-white overflow-hidden dark" data-testid="app-container">
        {/* Left Sidebar */}
        <aside className="w-56 border-r border-gray-800/50 flex flex-col bg-[#0d0d14]" data-testid="left-sidebar">
          {/* Personal Dropdown */}
          <div className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between text-white hover:bg-gray-800/50 h-10"
                  data-testid="personal-dropdown"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded" />
                    <span className="font-medium">Personal</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52 bg-[#1a1a24] border-gray-700">
                <DropdownMenuItem className="text-gray-300 hover:bg-gray-800">Personal Workspace</DropdownMenuItem>
                <DropdownMenuItem className="text-gray-300 hover:bg-gray-800">Team Workspace</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem className="text-gray-300 hover:bg-gray-800">Create Workspace</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* New Thread Button */}
          <div className="px-3 pb-3">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 text-gray-400 hover:text-white hover:bg-gray-800/50"
              data-testid="new-thread-btn"
            >
              <Plus className="h-4 w-4" />
              <span>New thread</span>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className={`w-full justify-start gap-3 mb-1 ${
                  activeNav === item.id 
                    ? "bg-cyan-500/20 text-cyan-400" 
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
                onClick={() => setActiveNav(item.id)}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <Badge className="ml-auto bg-green-600 text-white text-xs h-5 min-w-5">
                    {item.badge}
                  </Badge>
                )}
              </Button>
            ))}
          </nav>

          {/* Bookmarks */}
          <div className="px-2 py-2">
            <Collapsible open={bookmarksOpen} onOpenChange={setBookmarksOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wider px-2 py-1 hover:text-gray-300 w-full" data-testid="bookmarks-toggle">
                <ChevronRight className={`h-3 w-3 transition-transform ${bookmarksOpen ? "rotate-90" : ""}`} />
                Bookmarks
              </CollapsibleTrigger>
              <CollapsibleContent>
                {bookmarks.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className="w-full justify-start gap-2 text-gray-400 hover:text-white hover:bg-gray-800/50 h-8 text-sm"
                    data-testid={`bookmark-${item.id}`}
                  >
                    <item.icon className="h-3 w-3" />
                    <span className="truncate">{item.label}</span>
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* History */}
          <div className="px-2 py-2 border-t border-gray-800/50">
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wider px-2 py-1 hover:text-gray-300 w-full" data-testid="history-toggle">
                <ChevronRight className={`h-3 w-3 transition-transform ${historyOpen ? "rotate-90" : ""}`} />
                History
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-32">
                  {conversations.map((conv) => (
                    <Button
                      key={conv.id}
                      variant="ghost"
                      className="w-full justify-start gap-2 text-gray-400 hover:text-white hover:bg-gray-800/50 h-7 text-sm"
                      data-testid={`history-${conv.id}`}
                    >
                      <ChevronRight className="h-3 w-3" />
                      <span className="truncate">{conv.title}</span>
                    </Button>
                  ))}
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* User Avatar */}
          <div className="p-3 border-t border-gray-800/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-medium" data-testid="user-avatar">
                M
              </div>
              <span className="text-sm text-gray-300">Meg</span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Cyberpunk Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0f1419] to-[#0a0a0f]">
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: `
                linear-gradient(rgba(0, 255, 128, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 128, 0.03) 1px, transparent 1px)
              `,
              backgroundSize: "50px 50px",
            }} />
            {/* Matrix rain effect overlay */}
            <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRleHQgeD0iMCIgeT0iMTUiIGZpbGw9IiMwZjAiIGZvbnQtc2l6ZT0iMTAiPjAxPC90ZXh0Pjwvc3ZnPg==')]" />
          </div>

          {/* Top Tabs */}
          <header className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-gray-800/50">
            <div className="flex gap-1">
              {["chat", "cowork", "code"].map((tab) => (
                <Button
                  key={tab}
                  variant="ghost"
                  className={`px-4 py-2 rounded-full text-sm capitalize ${
                    activeTab === tab
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                  onClick={() => setActiveTab(tab)}
                  data-testid={`tab-${tab}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${scheduledEnabled ? "bg-green-500" : "bg-gray-500"}`} />
              <Button
                variant="ghost"
                className="text-gray-400 hover:text-white text-sm"
                onClick={() => setScheduledEnabled(!scheduledEnabled)}
                data-testid="scheduled-toggle"
              >
                Scheduled
              </Button>
            </div>
          </header>

          {/* Main Chat Area */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
            {/* Logo */}
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold mb-2 flex items-center justify-center gap-3" data-testid="logo-title">
                <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">OpenClaw</span>
                <span className="text-4xl">🦞</span>
              </h1>
              <p className="text-orange-500 tracking-[0.3em] text-sm font-medium">MISSION CONTROL</p>
            </div>

            {/* Model Selector Popover */}
            <div className="w-full max-w-2xl mb-4">
              <Popover open={isModelSelectorOpen} onOpenChange={setIsModelSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full bg-[#1a1a24]/80 border-gray-700 text-gray-300 hover:bg-gray-800/80 justify-between h-12"
                    data-testid="model-selector-trigger"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">PROVIDERS</span>
                      {selectedProvider && (
                        <>
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                          <span className="text-cyan-400">{selectedProvider}</span>
                        </>
                      )}
                    </div>
                    {isConnecting ? (
                      <span className="text-gray-500">Connecting...</span>
                    ) : selectedModel ? (
                      <span className="text-white">{selectedModel.name}</span>
                    ) : (
                      <span className="text-gray-500">+ select a provider</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[600px] p-0 bg-[#1a1a24] border-gray-700" align="start">
                  <div className="flex h-[400px]">
                    {/* Providers List */}
                    <ScrollArea className="w-48 border-r border-gray-700">
                      <div className="p-2">
                        <div className="text-xs text-gray-500 uppercase tracking-wider px-2 py-1 mb-1">Providers</div>
                        {Object.keys(MODEL_PROVIDERS).map((provider) => (
                          <Button
                            key={provider}
                            variant="ghost"
                            className={`w-full justify-between text-sm h-9 ${
                              selectedProvider === provider
                                ? "bg-cyan-500/20 text-cyan-400"
                                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                            }`}
                            onClick={() => setSelectedProvider(provider)}
                            data-testid={`provider-${provider}`}
                          >
                            <span>{provider}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">{MODEL_PROVIDERS[provider].models.length}</span>
                              <ChevronRight className="h-3 w-3 text-gray-500" />
                            </div>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Models List */}
                    <ScrollArea className="flex-1">
                      <div className="p-2">
                        {selectedProvider && (
                          <>
                            <div className="flex items-center justify-between px-2 py-1 mb-2">
                              <div className="text-xs text-gray-500 uppercase tracking-wider">
                                {selectedProvider.toUpperCase()}
                              </div>
                              <div className="flex gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-white">
                                      <Info className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Provider Info</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-white">
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-white">
                                      <Settings className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Settings</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                            {MODEL_PROVIDERS[selectedProvider].models.map((model) => (
                              <Button
                                key={model.id}
                                variant="ghost"
                                className={`w-full justify-between text-left h-auto py-3 px-3 mb-1 ${
                                  selectedModel?.id === model.id
                                    ? "bg-cyan-500/20 border border-cyan-500/50"
                                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                                }`}
                                onClick={() => {
                                  setSelectedModel(model);
                                  setIsModelSelectorOpen(false);
                                }}
                                data-testid={`model-${model.id}`}
                              >
                                <div className="flex flex-col items-start">
                                  <span className="font-medium text-white">{model.name}</span>
                                  {model.provider && (
                                    <span className="text-xs text-gray-500">{model.provider}</span>
                                  )}
                                  <span className="text-xs text-gray-500">{model.context}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-cyan-400 hover:text-cyan-300">
                                        <Zap className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Speed: {model.speed}</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-yellow-400 hover:text-yellow-300">
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit Config</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-green-400 hover:text-green-300">
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy ID</TooltipContent>
                                  </Tooltip>
                                </div>
                              </Button>
                            ))}
                          </>
                        )}
                        {!selectedProvider && (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            Select a provider to view models
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Chat Input Area */}
            <div className="w-full max-w-2xl">
              <div className="relative bg-[#1a1a24]/80 backdrop-blur-sm rounded-2xl border border-gray-700 p-3">
                {/* Input Row */}
                <div className="flex items-center gap-2">
                  {/* Plus Menu */}
                  <DropdownMenu open={isPlusMenuOpen} onOpenChange={setIsPlusMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 rounded-full ${isPlusMenuOpen ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800/50"}`}
                        data-testid="plus-menu-trigger"
                      >
                        {isPlusMenuOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-[#1a1a24] border-gray-700" align="start" data-testid="plus-menu-content">
                      <DropdownMenuItem className="text-gray-300 hover:bg-gray-800 gap-2" data-testid="menu-add-files">
                        <Image className="h-4 w-4" />
                        Add files or photos
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-gray-300 hover:bg-gray-800 gap-2" data-testid="menu-add-project">
                        <FolderPlus className="h-4 w-4" />
                        Add to project
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-gray-300 hover:bg-gray-800 gap-2" data-testid="menu-add-github">
                        <Github className="h-4 w-4" />
                        Add from GitHub
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-gray-700" />
                      
                      {/* Skills Submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-gray-300 hover:bg-gray-800 gap-2" data-testid="menu-skills">
                          <Zap className="h-4 w-4" />
                          Skills
                          {selectedSkills.length > 0 && (
                            <Badge className="ml-auto bg-amber-600 text-white text-xs">{selectedSkills.length}</Badge>
                          )}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="bg-[#1a1a24] border-gray-700" data-testid="skills-submenu">
                          {SKILLS.map((skill) => (
                            <DropdownMenuCheckboxItem
                              key={skill.id}
                              checked={selectedSkills.includes(skill.id)}
                              onCheckedChange={() => handleSkillToggle(skill.id)}
                              className="text-gray-300 hover:bg-gray-800 gap-2"
                              data-testid={`skill-${skill.id}`}
                            >
                              <skill.icon className="h-4 w-4 mr-2" />
                              {skill.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                          <DropdownMenuSeparator className="bg-gray-700" />
                          <DropdownMenuItem className="text-cyan-400 hover:bg-gray-800 gap-2" data-testid="manage-skills">
                            <Settings className="h-4 w-4" />
                            Manage skills
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-cyan-400 hover:bg-gray-800 gap-2" data-testid="add-skill">
                            <Plus className="h-4 w-4" />
                            Add skill
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      {/* Connectors Submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-gray-300 hover:bg-gray-800 gap-2" data-testid="menu-connectors">
                          <Link2 className="h-4 w-4" />
                          Connectors
                          <Badge className="ml-auto bg-amber-600 text-white text-xs">1</Badge>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="bg-[#1a1a24] border-gray-700" data-testid="connectors-submenu">
                          <DropdownMenuItem className="text-gray-300 hover:bg-gray-800 gap-2">
                            <Github className="h-4 w-4" />
                            GitHub
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-gray-300 hover:bg-gray-800 gap-2">
                            <Globe className="h-4 w-4" />
                            Slack
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-gray-700" />
                          <DropdownMenuItem className="text-cyan-400 hover:bg-gray-800 gap-2">
                            <Plus className="h-4 w-4" />
                            Add connector
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      {/* Plugins */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-gray-300 hover:bg-gray-800 gap-2" data-testid="menu-plugins">
                          <Puzzle className="h-4 w-4" />
                          Plugins
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="bg-[#1a1a24] border-gray-700" data-testid="plugins-submenu">
                          <DropdownMenuItem className="text-gray-300 hover:bg-gray-800 gap-2">
                            <Search className="h-4 w-4" />
                            Web Search
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-gray-300 hover:bg-gray-800 gap-2">
                            <FileText className="h-4 w-4" />
                            Document Reader
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-gray-700" />
                          <DropdownMenuItem className="text-cyan-400 hover:bg-gray-800 gap-2">
                            <Plus className="h-4 w-4" />
                            Browse plugins
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSeparator className="bg-gray-700" />

                      <DropdownMenuItem className="text-gray-300 hover:bg-gray-800 gap-2" data-testid="menu-research">
                        <Search className="h-4 w-4" />
                        Research
                      </DropdownMenuItem>

                      <DropdownMenuCheckboxItem 
                        checked={webSearchEnabled}
                        onCheckedChange={setWebSearchEnabled}
                        className="text-gray-300 hover:bg-gray-800 gap-2"
                        data-testid="menu-web-search"
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Web search
                      </DropdownMenuCheckboxItem>

                      {/* Use Style Submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-gray-300 hover:bg-gray-800 gap-2" data-testid="menu-use-style">
                          <Palette className="h-4 w-4" />
                          Use style
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="bg-[#1a1a24] border-gray-700" data-testid="style-submenu">
                          {WRITING_STYLES.map((style) => (
                            <DropdownMenuCheckboxItem
                              key={style.id}
                              checked={selectedStyle === style.id}
                              onCheckedChange={() => setSelectedStyle(style.id)}
                              className="text-gray-300 hover:bg-gray-800"
                              data-testid={`style-${style.id}`}
                            >
                              {style.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Agent Mode Toggle */}
                  <Button
                    variant={agentMode ? "default" : "ghost"}
                    size="sm"
                    className={`rounded-full h-8 px-3 gap-1.5 ${
                      agentMode 
                        ? "bg-cyan-600 hover:bg-cyan-700 text-white" 
                        : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                    }`}
                    onClick={() => setAgentMode(!agentMode)}
                    data-testid="agent-mode-toggle"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span className="text-sm">Agent</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>

                  {/* Text Input */}
                  <Input
                    placeholder="Ask anything..."
                    className="flex-1 bg-transparent border-none text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    data-testid="chat-input"
                  />

                  {/* Model Selector Button */}
                  <Button
                    variant="ghost"
                    className="text-gray-400 hover:text-white gap-1 text-sm"
                    onClick={() => setIsModelSelectorOpen(true)}
                    data-testid="inline-model-selector"
                  >
                    {selectedModel ? selectedModel.name : "Select model"}
                    <ChevronDown className="h-3 w-3" />
                  </Button>

                  {/* Action Buttons */}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" data-testid="mic-btn">
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-gray-400 hover:text-white"
                    onClick={handleSendMessage}
                    data-testid="send-btn"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="w-full max-w-2xl mt-8 grid grid-cols-2 gap-4">
              <FeatureCard
                icon={<Sparkles className="h-5 w-5 text-cyan-400" />}
                title="Select a model"
                description="Choose from local and cloud models for your tasks"
                onClick={() => setIsModelSelectorOpen(true)}
                testId="feature-select-model"
              />
              <FeatureCard
                icon={<Bot className="h-5 w-5 text-green-400" />}
                title="Try Agent"
                description="Agent works on any task: building apps, editing files, running commands"
                onClick={() => {
                  setAgentMode(true);
                  setActiveNav("agent");
                }}
                testId="feature-try-agent"
              />
              <FeatureCard
                icon={<Compass className="h-5 w-5 text-purple-400" />}
                title="Deep Research"
                description="Comprehensive research that synthesises information from multiple sources"
                onClick={() => handleSkillToggle("deep-research")}
                testId="feature-deep-research"
              />
              <FeatureCard
                icon={<Rocket className="h-5 w-5 text-orange-400" />}
                title="Mission Control"
                description="Manage swarm jobs, heartbeats, approvals, and live agent monitoring"
                onClick={() => setActiveNav("dashboard")}
                testId="feature-mission-control"
              />
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description, onClick, testId }) {
  return (
    <button
      className="p-4 bg-[#1a1a24]/60 backdrop-blur-sm rounded-xl border border-gray-800 hover:border-gray-700 hover:bg-[#1a1a24]/80 transition-all text-left group"
      onClick={onClick}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-gray-800/50 group-hover:bg-gray-700/50 transition-colors">
          {icon}
        </div>
        <div>
          <h3 className="font-medium text-white mb-1">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}

export default App;
