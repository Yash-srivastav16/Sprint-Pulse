import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { motion } from 'framer-motion';

interface AppShellProps {
  children: ReactNode;
  onOpenCommand: () => void;
}

export function AppShell({ children, onOpenCommand }: AppShellProps) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#eef5f4] text-foreground dark:bg-dark-bg">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(235,242,246,0.92)_42%,rgba(225,236,241,0.96)),linear-gradient(90deg,rgba(21,154,140,0.08),transparent_34%,rgba(114,84,184,0.08))] dark:bg-[linear-gradient(135deg,#0a0e1a,#141824_54%,#1c212e),linear-gradient(90deg,rgba(21,154,140,0.12),transparent_34%,rgba(114,84,184,0.12))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.26] [background-image:linear-gradient(rgba(21,154,140,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(21,154,140,0.1)_1px,transparent_1px)] [background-size:42px_42px]" />
      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar onOpenCommand={onOpenCommand} />
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-auto"
        >
          <div className="page-content">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}
