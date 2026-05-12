import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { AppShell } from './AppShell';
import { CommandPalette } from '../ui/command-palette';
import { AIChatAssistant } from '../ai/AIChatAssistant';
import { Button } from '../ui/button';

interface EnhancedShellProps {
  children: React.ReactNode;
}

export function EnhancedShell({ children }: EnhancedShellProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  return (
    <>
      <AppShell onOpenCommand={() => setCommandPaletteOpen(true)}>{children}</AppShell>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <AIChatAssistant open={aiChatOpen} onOpenChange={setAiChatOpen} />
      
      {/* Floating AI Assistant Button */}
      {!aiChatOpen && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1, type: 'spring', stiffness: 200 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <Button
            size="icon"
            className="h-14 w-14 rounded-full border border-white/25 bg-gradient-to-br from-ai-500 via-primary-500 to-info-500 shadow-float ring-1 ring-primary-200/20 hover:shadow-glow-lg"
            onClick={() => setAiChatOpen(true)}
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles className="h-6 w-6 text-white" />
            </motion.div>
          </Button>
        </motion.div>
      )}
    </>
  );
}
