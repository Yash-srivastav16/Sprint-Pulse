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
    <div className="relative flex h-screen overflow-hidden bg-[#eef5f8] text-foreground dark:bg-dark-bg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-8%,rgba(16,169,154,0.20),transparent_30rem),radial-gradient(circle_at_88%_0%,rgba(132,98,232,0.16),transparent_28rem),linear-gradient(135deg,rgba(255,255,255,0.88),rgba(235,244,248,0.92)_44%,rgba(226,236,243,0.96))] dark:bg-[radial-gradient(circle_at_18%_-8%,rgba(16,169,154,0.18),transparent_30rem),radial-gradient(circle_at_86%_0%,rgba(132,98,232,0.18),transparent_30rem),linear-gradient(135deg,#070b14,#101827_52%,#172238)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(16,169,154,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(68,123,219,0.10)_1px,transparent_1px)] [background-size:44px_44px] dark:opacity-[0.16]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/55 to-transparent dark:from-white/[0.035]" />
      <Sidebar />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar onOpenCommand={onOpenCommand} />
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-0 flex-1 overflow-auto"
        >
          <div className="page-content">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}
