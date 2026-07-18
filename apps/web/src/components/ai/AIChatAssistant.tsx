import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X, Minimize2, Maximize2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useProject } from '@/context/ProjectContext';
import { api } from '@/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

function TypeWriter({ text, speed = 30 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed]);

  return <span>{displayedText}</span>;
}

export function AIChatAssistant({ open, onOpenChange, className }: AIChatAssistantProps) {
  const { persona } = useAuth();
  const { project, selectedProjectId, selectedSprintId } = useProject();
  const projectLabel = project?.projectName ?? 'the selected project';
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi, I can help you read SprintPulse signals, decide what to inspect next, and prepare the sprint story for the team.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const question = input;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response =
        selectedProjectId && persona
          ? await api.chatProjectAi(selectedProjectId, {
              personaId: persona.id,
              message: question,
              sprintId: selectedSprintId ?? undefined
            })
          : {
              answer: getFallbackResponse(question),
              suggestedActions: [],
              meta: { enabled: false, source: 'disabled' as const, generatedAt: new Date().toISOString() }
            };
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.suggestedActions.length
          ? `${response.answer}\n\nNext: ${response.suggestedActions.join(' | ')}`
          : response.answer,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (err) {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'SprintPulse assistant is unavailable right now.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const getFallbackResponse = (userInput: string): string => {
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('health') || lowerInput.includes('score')) {
      return `Open the ${projectLabel} dashboard and start with readiness, at-risk members, blockers, and the team pulse order. Those are the safest health signals because they come from the current SprintPulse project data.`;
    }
    
    if (lowerInput.includes('risk') || lowerInput.includes('flag')) {
      return 'Use the risk flags panel to explain what changed, who is affected, and what action is recommended. For the demo, avoid guessing beyond the visible project signals.';
    }
    
    if (lowerInput.includes('productivity') || lowerInput.includes('sprint')) {
      return `For ${projectLabel}, tell the sprint story through standup participation, Jira issue movement, Git activity, and unresolved blockers. That keeps productivity grounded in evidence.`;
    }
    
    if (lowerInput.includes('role') || lowerInput.includes('permission')) {
      return `${persona?.title ?? 'Your role'} controls which project actions are visible. Scrum Masters can configure projects and integrations, while contributors focus on standups and their own pulse.`;
    }

    return 'I can help with team health, risk flags, sprint readiness, standup signals, Jira/Git sync, and member pulse interpretation.';
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className={cn(
        'fixed bottom-3 right-3 z-50 sm:bottom-6 sm:right-6',
        isMinimized ? 'w-[min(calc(100vw-1.5rem),20rem)]' : 'w-[min(calc(100vw-1.5rem),26rem)]',
        className
      )}
    >
      <Card className="premium-surface overflow-hidden rounded-2xl border-ai-500/25 text-slate-950 shadow-[0_28px_90px_rgba(7,11,20,0.28)] dark:text-white">
        <CardHeader className="border-b border-slate-200/80 p-4 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ai-300/30 bg-gradient-to-br from-ai-500 to-info-500 shadow-[0_16px_38px_rgba(132,98,232,0.24)]"
              >
                <Sparkles className="h-4 w-4 text-white" />
              </motion.div>
              <div className="min-w-0">
                <h3 className="m-0 truncate text-sm font-black text-slate-950 dark:text-white">
                  SprintPulse AI
                </h3>
                <p className="m-0 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">Signal-aware copilot</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-950/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => setIsMinimized(!isMinimized)}
                aria-label={isMinimized ? 'Expand AI assistant' : 'Minimize AI assistant'}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-slate-500 hover:bg-danger-500/10 hover:text-danger-700 dark:text-slate-300 dark:hover:text-danger-100"
                onClick={() => onOpenChange(false)}
                aria-label="Close AI assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-0">
            <div className="h-[min(28rem,calc(100vh-14rem))] space-y-4 overflow-y-auto p-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[84%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm',
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-primary-500 to-info-500 text-white'
                          : 'border border-ai-500/20 bg-ai-500/[0.08] text-slate-700 dark:text-slate-100'
                      )}
                    >
                      {message.role === 'assistant' && messages[messages.length - 1].id === message.id ? (
                        <TypeWriter text={message.content} />
                      ) : (
                        message.content
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="rounded-2xl border border-ai-500/20 bg-ai-500/[0.08] px-4 py-3">
                    <div className="flex gap-1">
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                        className="h-2 w-2 rounded-full bg-ai-500"
                      />
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                        className="h-2 w-2 rounded-full bg-ai-500"
                      />
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                        className="h-2 w-2 rounded-full bg-ai-500"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-200/80 p-4 dark:border-white/10">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask SprintPulse..."
                  className="min-h-11 flex-1 rounded-xl"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim()}
                  className="h-11 w-11 rounded-xl bg-gradient-to-r from-primary-500 to-info-500 text-white shadow-[0_12px_30px_rgba(16,169,154,0.22)] transition hover:-translate-y-0.5"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}
