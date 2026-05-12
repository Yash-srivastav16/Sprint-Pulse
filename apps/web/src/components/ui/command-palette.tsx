import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Command } from 'cmdk';
import { 
  Activity,
  CalendarDays,
  Search, 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  MessageSquare, 
  PlugZap,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from '@/context/ProjectContext';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CommandItem = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  category: 'Navigation' | 'Actions';
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { selectedProjectId } = useProject();
  const [search, setSearch] = useState('');
  const projectBase = selectedProjectId ? `/projects/${selectedProjectId}` : '/projects';
  const commands: CommandItem[] = [
    { id: 'projects', label: 'Projects', icon: FolderKanban, href: '/projects', category: 'Navigation' },
    { id: 'workspace', label: 'Workspace', icon: Activity, href: projectBase, category: 'Navigation' },
    { id: 'standup', label: 'Standups', icon: MessageSquare, href: selectedProjectId ? `${projectBase}/standups` : '/projects', category: 'Navigation' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: selectedProjectId ? `${projectBase}/dashboard` : '/projects', category: 'Navigation' },
    ...(selectedProjectId
      ? [
          { id: 'team', label: 'Team Members', icon: Users, href: `${projectBase}/team`, category: 'Navigation' as const },
          { id: 'sprints', label: 'Sprints', icon: CalendarDays, href: `${projectBase}/sprints`, category: 'Navigation' as const },
          { id: 'integrations', label: 'Integrations', icon: PlugZap, href: `${projectBase}/integrations`, category: 'Navigation' as const },
        ]
      : []),
    { id: 'health', label: 'View Health Metrics', icon: TrendingUp, href: selectedProjectId ? `${projectBase}/dashboard` : '/projects', category: 'Actions' },
  ];

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const handleSelect = (command: CommandItem) => {
    navigate(command.href);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Command Palette */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl mx-4"
            >
              <Command className="rounded-lg border border-border bg-background shadow-2xl overflow-hidden">
                <div className="flex items-center border-b border-border px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <Command.Input
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Type a command or search..."
                    className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <Command.List className="max-h-[400px] overflow-y-auto p-2">
                  <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                    No results found.
                  </Command.Empty>

                  {['Navigation', 'Actions'].map((category) => (
                    <Command.Group key={category} heading={category} className="mb-2">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {category}
                      </div>
                      {commands
                        .filter((cmd) => cmd.category === category)
                        .map((command) => (
                          <Command.Item
                            key={command.id}
                            value={command.label}
                            onSelect={() => handleSelect(command)}
                            className={cn(
                              'relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5',
                              'text-sm outline-none transition-colors',
                              'hover:bg-accent hover:text-accent-foreground',
                              'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground'
                            )}
                          >
                            <command.icon className="mr-3 h-4 w-4" />
                            <span>{command.label}</span>
                          </Command.Item>
                        ))}
                    </Command.Group>
                  ))}
                </Command.List>
                
                <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono font-medium">
                    ⌘K
                  </kbd>
                  {' '}to toggle • 
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono font-medium ml-1">
                    ↑↓
                  </kbd>
                  {' '}to navigate • 
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono font-medium ml-1">
                    ↵
                  </kbd>
                  {' '}to select
                </div>
              </Command>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
